import yaml from "js-yaml";
import type {
  AzurePipelineRepository,
  AzurePipelineYaml,
} from "#config";
import type { PipelineReference } from "#validators/types";
import { getLineNumberForMatch, getContextForMatch } from "#validators/utils";

/**
 * Parse a version reference string to determine its type and normalized value
 *
 * @param ref - The version reference string from Azure Pipelines
 * @returns Object containing version and version type
 */
export function parseVersionReference(ref: string): {
  version: string;
  versionType: "tag" | "branch" | "commit";
} {
  // Default to branch if we can't determine
  let versionType: "tag" | "branch" | "commit" = "branch";
  let version = ref;

  // Handle Azure DevOps ref formats
  if (ref.startsWith("refs/tags/")) {
    versionType = "tag";
    // Extract the tag name from refs/tags/v1.0
    version = ref.substring("refs/tags/".length);
  } else if (ref.startsWith("refs/heads/")) {
    versionType = "branch";
    // Extract the branch name from refs/heads/main
    version = ref.substring("refs/heads/".length);
  } else if (ref.match(/^[0-9a-f]{40}$/i)) {
    versionType = "commit";
  }

  return { version, versionType };
}

/**
 * Extract repository declarations from a YAML file
 *
 * @param fileContent - Content of the YAML file to analyze
 * @returns Object containing repository alias mapping and version information
 */
export function extractRepositoryDeclarations(fileContent: string): {
  repos: Record<string, string>;
  repoVersions: Record<string, { version?: string; versionType?: "tag" | "branch" | "commit" }>;
} {
  const repos: Record<string, string> = {};
  const repoVersions: Record<
    string,
    { version?: string; versionType?: "tag" | "branch" | "commit" }
  > = {};

  try {
    // Support multiple YAML documents in a single file
    const parsedDocuments = yaml.loadAll(fileContent) as AzurePipelineYaml[];
    
    // Process each document
    for (const parsedContent of parsedDocuments) {
      if (parsedContent?.resources?.repositories) {
        const repositories = parsedContent.resources.repositories;
        if (Array.isArray(repositories)) {
          repositories.forEach((repo: AzurePipelineRepository) => {
            // Process repository declarations
            if (repo.repository && repo.name) {
              repos[repo.repository] = repo.name;

              // Extract version information if available
              if (repo.ref) {
                const versionInfo = parseVersionReference(repo.ref);
                repoVersions[repo.repository] = versionInfo;
              }
            } else if (repo.type === "git" && repo.name) {
              // Handle simple repository references
              repos[repo.name] = repo.name;

              // Extract version information if available
              if (repo.ref) {
                const versionInfo = parseVersionReference(repo.ref);
                repoVersions[repo.name] = versionInfo;
              }
            }
          });
        }
      }
    }
  } catch (error) {
    // If YAML parsing fails, we'll still try to extract using regex
    // Only log in non-test environments
    if (process.env.NODE_ENV !== "test") {
      console.error(`Warning: Could not parse YAML: ${error}`);
    }
  }

  // If no repositories were found via YAML parsing, try regex extraction
  if (Object.keys(repos).length === 0) {
    const repoPattern = /- repository:\s*([^\s\n]+)[\s\S]*?name:\s*([^\s\n]+)/g;
    let match;

    while ((match = repoPattern.exec(fileContent)) !== null) {
      const alias = match[1] ?? "";
      const name = match[2] ?? "";
      repos[alias] = name;

      // Try to extract version information using regex as well
      const versionMatch = fileContent.match(
        new RegExp(`repository:\\s*${alias}[\\s\\S]*?ref:\\s*([^\\s\\n]+)`, "i")
      );
      if (versionMatch?.[1]) {
        const version = versionMatch[1];
        const versionInfo = parseVersionReference(version);
        repoVersions[alias] = versionInfo;
      }
    }
  }

  return { repos, repoVersions };
}

/**
 * Helper function to extract references from regex matches
 *
 * @param filePath - Path to the source file
 * @param fileContent - Content to search in
 * @param patterns - Array of regex patterns to match
 * @param hasExternalReference - Whether this is an external repository reference
 * @returns Array of references found
 */
export function extractReferencesFromPatterns(
  filePath: string,
  fileContent: string,
  patterns: RegExp[],
  hasExternalReference: boolean
): PipelineReference[] {
  const references: PipelineReference[] = [];

  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0; // Reset regex state

    while ((match = pattern.exec(fileContent)) !== null) {
      const targetPath = match[1] ?? "";
      const lineNumber = getLineNumberForMatch(fileContent, match);
      const context = getContextForMatch(fileContent, lineNumber);

      // Create the base reference
      const reference: PipelineReference = {
        source: filePath,
        target: targetPath,
        lineNumber,
        context,
      };

      // Add external repository properties if needed
      if (hasExternalReference) {
        const targetRepo = match[2] ?? "";

        // Add the repository reference to the reference
        Object.assign(reference, {
          targetRepo,
        });
      }

      references.push(reference);
    }
  }

  return references;
}