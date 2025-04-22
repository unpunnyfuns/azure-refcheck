import {
  EXTERNAL_REFERENCE_PATTERNS,
  LOCAL_REFERENCE_PATTERNS,
  type RepoConfig
} from "#config";
import { findPipelineFiles, readFileContent } from "#utils/file";
import type { PipelineReference } from "#validators/types";
import { extractReferencesFromPatterns, extractRepositoryDeclarations } from "#validators/parsers";

/**
 * Extract all types of references from a YAML pipeline file
 *
 * @param filePath - Path to the pipeline file
 * @param fileContent - Content of the file to analyze
 * @returns Array of pipeline references found in the file
 */
export function extractReferences(filePath: string, fileContent: string): PipelineReference[] {
  // Use the helper function to extract references from different patterns
  const localReferences = extractReferencesFromPatterns(
    filePath,
    fileContent,
    LOCAL_REFERENCE_PATTERNS,
    false
  );

  const externalReferences = extractReferencesFromPatterns(
    filePath,
    fileContent,
    EXTERNAL_REFERENCE_PATTERNS,
    true
  );

  // Deduplicate references by creating a unique key for each reference
  const uniqueRefs = new Map<string, PipelineReference>();

  // Process local references first
  for (const ref of localReferences) {
    const key = `${ref.source}:${ref.lineNumber}:${ref.target}`;
    // Only add if not an external reference with the same key
    if (!uniqueRefs.has(key)) {
      uniqueRefs.set(key, ref);
    }
  }

  // Process external references (which take precedence)
  for (const ref of externalReferences) {
    const key = `${ref.source}:${ref.lineNumber}:${ref.target}`;
    uniqueRefs.set(key, ref);
  }

  // Create combined reference list
  const references = Array.from(uniqueRefs.values());

  // Extract repository declarations and version information
  try {
    const { repos: repoDeclarations, repoVersions } = extractRepositoryDeclarations(fileContent);

    // Add repository declarations with appropriate context
    for (const [alias, repoName] of Object.entries(repoDeclarations)) {
      const versionInfo = repoVersions[alias];

      const repositoryRef: PipelineReference = {
        source: filePath,
        target: `repository:${repoName}`,
        targetRepo: alias,
        lineNumber: 0, // We don't have exact line numbers for parsed content
        context: `Repository reference: ${alias} -> ${repoName}`,
      };

      // Add version information if available
      if (versionInfo?.version) {
        repositoryRef.targetVersion = versionInfo.version;
        repositoryRef.versionType = versionInfo.versionType;
      }

      references.push(repositoryRef);

      // Apply version information to related template references if they use this repository
      for (const ref of references) {
        if (ref.targetRepo === alias && !ref.targetVersion && versionInfo?.version) {
          // This template reference uses a repository with a specified version
          ref.targetVersion = versionInfo.version;
          ref.versionType = versionInfo.versionType;
        }
      }
    }
  } catch (error) {
    // If YAML parsing fails, we'll still have the regex-based references
    // Only log in non-test environments
    if (process.env.NODE_ENV !== "test") {
      console.error(`Warning: Could not parse YAML in ${filePath}: ${error}`);
    }
  }

  return references;
}

/**
 * Collects all references from all repositories
 *
 * @param repoConfigs - Repository configurations to analyze
 * @returns Array of all discovered references
 */
export function collectAllReferences(repoConfigs: RepoConfig[]): PipelineReference[] {
  const allReferences: PipelineReference[] = [];
  const errors: Array<{ path: string; error: unknown }> = [];

  // Process each repository
  repoConfigs.forEach((repo) => {
    try {
      const pipelineFiles = findPipelineFiles(repo.path);

      // Process each pipeline file in the repository
      pipelineFiles.forEach((filePath) => {
        try {
          const fileContent = readFileContent(filePath);
          const fileReferences = extractReferences(filePath, fileContent);
          allReferences.push(...fileReferences);
        } catch (error) {
          errors.push({ path: filePath, error });
          // Only log in non-test environments
          if (process.env.NODE_ENV !== "test") {
            console.error(`Error processing file ${filePath}: ${String(error)}`);
          }
        }
      });
    } catch (error) {
      errors.push({ path: repo.path, error });
      if (process.env.NODE_ENV !== "test") {
        console.error(`Error processing repository ${repo.name} (${repo.path}): ${error}`);
      }
    }
  });

  // Provide summary of errors if any occurred
  if (errors.length > 0 && process.env.NODE_ENV !== "test") {
    console.error(`Failed to process ${errors.length} files during reference collection`);
  }

  return allReferences;
}

/**
 * Scans repositories to discover repository aliases from pipeline declarations
 *
 * @param repoConfigs - Repository configurations to scan
 * @returns Enhanced repository configurations with discovered aliases
 */
export function discoverRepositoryAliases(repoConfigs: RepoConfig[]): RepoConfig[] {
  // First, create a map of repo names to their configs
  const repoNameMap = new Map<string, RepoConfig>();
  repoConfigs.forEach((repo) => {
    repoNameMap.set(repo.name, repo);

    // Also map by normalized name (to handle org/repo vs plain name differences)
    const normalizedName = repo.name.split("/").pop()!;
    if (normalizedName !== repo.name) {
      repoNameMap.set(normalizedName, repo);
    }
  });

  // Map to track all discovered aliases
  const discoveredAliases = new Map<string, Set<string>>();

  // Initialize with existing aliases
  repoConfigs.forEach((repo) => {
    discoveredAliases.set(repo.name, new Set(repo.aliases || []));
  });

  // Now scan all repos for pipeline declarations
  repoConfigs.forEach((repo) => {
    const pipelineFiles = findPipelineFiles(repo.path);

    pipelineFiles.forEach((filePath) => {
      try {
        const fileContent = readFileContent(filePath);
        const { repos: repoDeclarations } = extractRepositoryDeclarations(fileContent);

        // For each declaration, add the alias to the corresponding repo
        for (const [alias, repoName] of Object.entries(repoDeclarations)) {
          // Find the repo config this refers to
          const targetRepo = repoNameMap.get(repoName);

          if (targetRepo) {
            const aliases = discoveredAliases.get(targetRepo.name) || new Set<string>();
            aliases.add(alias);
            discoveredAliases.set(targetRepo.name, aliases);
          }
          // If we can't find the repo, we'll just skip this alias
        }
      } catch (error) {
        // Skip this file if we encounter an error
        if (process.env.NODE_ENV !== "test") {
          console.error(`Error processing ${filePath} for repo aliases: ${error}`);
        }
      }
    });
  });

  // Now update repo configs with the discovered aliases
  const enhancedConfigs = repoConfigs.map((repo) => {
    const aliases = discoveredAliases.get(repo.name);
    if (aliases) {
      return {
        ...repo,
        aliases: Array.from(aliases),
      };
    }
    return repo;
  });

  return enhancedConfigs;
}