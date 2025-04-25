import type { RepoConfig } from "#config";
import { fileExists, joinPaths } from "#utils/filesystem";
import { validateFileAtVersion, validateRepoVersion } from "#utils/git";
import { parseVersionReference } from "#validators/parsers";
import {
  collectAllReferences,
  discoverRepositoryAliases,
} from "#validators/references";
import {
  type PipelineReference,
  ReferenceValidationResult,
  type ValidationResult,
} from "#validators/types";
import { findRepoConfig, resolveTargetPath } from "#validators/utils";

/**
 * Validates a reference to a template in an external repository
 */
export function validateExternalReference(
  reference: PipelineReference,
  targetRepo: string,
  repoConfigs: RepoConfig[],
  validReferences: PipelineReference[],
  brokenReferences: PipelineReference[],
  versionIssues: PipelineReference[]
): ReferenceValidationResult {
  // Find the target repository configuration (including special cases like "local")
  const targetRepoConfig = findRepoConfig(targetRepo, repoConfigs);

  if (!targetRepoConfig) {
    // Referenced repo not found in config
    brokenReferences.push({
      ...reference,
      target: `Unknown repository: ${targetRepo}`,
    });
    return ReferenceValidationResult.MISSING_REPO;
  }

  // If the target repo is set to skipValidation, consider all references to it valid
  if (targetRepoConfig.skipValidation) {
    validReferences.push(reference);
    return ReferenceValidationResult.VALID;
  }

  // Determine which version to use for validation:
  // 1. First use explicit targetVersion from the reference if present
  // 2. Otherwise use the ref from the target repo config if specified
  // 3. Default to HEAD if neither is present
  let version: string | undefined;
  let versionType: "branch" | "tag" | "commit" | undefined;

  if (reference.targetVersion) {
    // Use the version specified in the reference
    version = reference.targetVersion;
    versionType = reference.versionType;
  } else if (targetRepoConfig.ref) {
    // Use the version from the repo config
    version = targetRepoConfig.ref;
  }

  // If we have a version to validate, do so
  if (version) {
    // Handle Azure Pipelines ref format if needed
    if (version.startsWith("refs/")) {
      // The parseVersionReference function will handle extracting the actual version
      // and determining the type, but we need to make sure we normalize before validation
      const versionInfo = parseVersionReference(version);
      version = versionInfo.version;
      versionType = versionInfo.versionType;
    } else if (!versionType) {
      // If version type is not explicitly set, try to determine it from the version string
      if (version.match(/^[0-9a-f]{40}$/i)) {
        versionType = "commit";
      } else if (version.startsWith("v") && version.match(/^v\d/)) {
        // Common tag format (v1.0.0)
        versionType = "tag";
      } else {
        // Default to branch
        versionType = "branch";
      }
    }

    if (!validateRepoVersion(targetRepoConfig.path, version, versionType)) {
      versionIssues.push({
        ...reference,
        target: `Invalid version ${version} in repo ${targetRepo}`,
        targetVersion: version, // Update with the normalized version
        versionType, // Update with detected type
      });
      return ReferenceValidationResult.INVALID_VERSION;
    }

    // Update the reference with normalized version information
    reference.targetVersion = version;
    reference.versionType = versionType;
  }

  // Resolve the file path within the target repository
  const resolvedPath = joinPaths(
    targetRepoConfig.path,
    reference.target.startsWith("/")
      ? reference.target.substring(1)
      : reference.target
  );

  // First check if the file exists directly in the filesystem (latest version)
  if (fileExists(resolvedPath) && !reference.targetVersion) {
    validReferences.push(reference);
    return ReferenceValidationResult.VALID;
  }

  // If a version is specified or the file wasn't found at HEAD, check with git version handling
  // Determine the version type if it's not already set
  const versionToUse = reference.targetVersion || targetRepoConfig.ref;
  let versionTypeToUse = reference.versionType;

  // If we have a version but no type, try to determine it
  if (versionToUse && !versionTypeToUse) {
    if (versionToUse.match(/^[0-9a-f]{40}$/i)) {
      versionTypeToUse = "commit";
    } else if (versionToUse.startsWith("v") && versionToUse.match(/^v\d/)) {
      versionTypeToUse = "tag";
    } else {
      versionTypeToUse = "branch";
    }
  }

  if (
    !validateFileAtVersion(
      targetRepoConfig.path,
      reference.target,
      versionToUse,
      versionTypeToUse
    )
  ) {
    const versionDescription = versionToUse;
    brokenReferences.push({
      ...reference,
      target: `Template not found: ${reference.target} in repo ${targetRepo}${
        versionDescription ? ` at version ${versionDescription}` : ""
      }`,
    });
    return ReferenceValidationResult.BROKEN_PATH;
  }

  // All checks passed
  validReferences.push(reference);
  return ReferenceValidationResult.VALID;
}

/**
 * Validates a reference to a template in the local repository
 */
export function validateLocalReference(
  reference: PipelineReference,
  validReferences: PipelineReference[],
  brokenReferences: PipelineReference[]
): ReferenceValidationResult {
  // Resolve the path relative to the source file
  const resolvedPath = resolveTargetPath(reference.source, reference.target);

  if (fileExists(resolvedPath)) {
    validReferences.push(reference);
    return ReferenceValidationResult.VALID;
  }

  brokenReferences.push({
    ...reference,
    target: resolvedPath, // Use resolved path for clarity in reporting
  });
  return ReferenceValidationResult.BROKEN_PATH;
}

/**
 * Validates a pipeline reference
 * Handles all repository references uniformly
 *
 * @param reference - The reference to validate
 * @param repoConfigs - Available repository configurations
 * @param validReferences - Collection to add valid references to
 * @param brokenReferences - Collection to add broken references to
 * @param versionIssues - Collection to add version issues to
 * @returns The validation result type
 */
export function validateReference(
  reference: PipelineReference,
  repoConfigs: RepoConfig[],
  validReferences: PipelineReference[],
  brokenReferences: PipelineReference[],
  versionIssues: PipelineReference[]
): ReferenceValidationResult {
  // If there's a specific target repo, validate as cross-repo reference
  const targetRepo = reference.targetRepo;

  try {
    if (targetRepo) {
      return validateExternalReference(
        reference,
        targetRepo,
        repoConfigs,
        validReferences,
        brokenReferences,
        versionIssues
      );
    }

    return validateLocalReference(reference, validReferences, brokenReferences);
  } catch (error) {
    // Safety net for any unexpected errors during validation
    if (process.env.NODE_ENV !== "test") {
      console.error(
        `Error validating reference ${reference.source} -> ${reference.target}: ${error}`
      );
    }

    // Add to broken references with error information
    brokenReferences.push({
      ...reference,
      target: `Error validating: ${reference.target} - ${error instanceof Error ? error.message : String(error)}`,
    });

    return ReferenceValidationResult.BROKEN_PATH;
  }
}

/**
 * Core validation function for validating pipeline references
 *
 * @param repos - Single repository path or array of repository configurations
 * @returns Validation result containing references and validation status
 */
export function validatePipelines(
  repos: string | RepoConfig[]
): ValidationResult {
  // Convert single path to RepoConfig if necessary
  const initialRepoConfigs: RepoConfig[] =
    typeof repos === "string"
      ? [{ name: "repo", path: repos, aliases: [] }]
      : repos;

  // Enhance repo configs with discovered aliases
  const repoConfigs = discoverRepositoryAliases(initialRepoConfigs);

  if (process.env.NODE_ENV !== "test" && initialRepoConfigs.length > 1) {
    console.log("Repository configurations with discovered aliases:");
    repoConfigs.forEach((repo) => {
      console.log(`- ${repo.name}: ${repo.aliases?.join(", ") || "none"}`);
    });
  }

  const brokenReferences: PipelineReference[] = [];
  const validReferences: PipelineReference[] = [];
  const versionIssues: PipelineReference[] = [];

  // Extract all references from all repos
  const allReferences = collectAllReferences(repoConfigs);

  // Validate each reference
  allReferences.forEach((reference) => {
    // Skip validation for repository declarations (just metadata)
    if (reference.target.startsWith("repository:")) {
      validReferences.push(reference);
      return;
    }

    validateReference(
      reference,
      repoConfigs,
      validReferences,
      brokenReferences,
      versionIssues
    );
  });

  // Create the validation result
  const result = {
    isValid: brokenReferences.length === 0 && versionIssues.length === 0,
    brokenReferences,
    validReferences,
    versionIssues,
  };

  return result;
}
