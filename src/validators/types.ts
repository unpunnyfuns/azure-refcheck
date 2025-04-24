import type { RepoConfig } from "#config";

/**
 * Represents a reference between pipeline files
 */
export type PipelineReference = {
  /** Source file path */
  source: string;
  /** Target file path or resource */
  target: string;
  /** Repository identifier for cross-repo references */
  targetRepo?: string;
  /** Version reference (tag, branch, or commit) */
  targetVersion?: string;
  /** Type of version reference */
  versionType?: "tag" | "branch" | "commit";
  /** Line number in source file where reference appears */
  lineNumber: number;
  /** Context surrounding the reference */
  context: string;
};

/**
 * Results of a pipeline validation operation
 */
export type ValidationResult = {
  /** Whether all references are valid */
  isValid: boolean;
  /** List of references that could not be resolved */
  brokenReferences: PipelineReference[];
  /** List of references that were successfully resolved */
  validReferences: PipelineReference[];
  /** List of references with version-related issues */
  versionIssues?: PipelineReference[];
};

/**
 * Repository declaration with version information
 */
export interface RepoDeclaration {
  name: string;
  version?: string;
  versionType?: "tag" | "branch" | "commit";
}

/**
 * Possible validation outcomes for a reference
 */
export enum ReferenceValidationResult {
  VALID = "valid",
  BROKEN_PATH = "broken_path",
  MISSING_REPO = "missing_repo",
  INVALID_VERSION = "invalid_version",
}
