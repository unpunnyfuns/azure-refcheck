/**
 * Configuration types used across the application
 */

/**
 * Configuration for a repository to be validated
 */
export type RepoConfig = {
  /** Repository name (as defined in Azure DevOps) */
  name: string;
  /** Local filesystem path to the repository */
  path: string;
  /**
   * Alternative names that may be used to reference this repo.
   * These are typically discovered automatically from pipeline files.
   */
  aliases?: string[];
  /**
   * Optional git reference to use for validation.
   * Can be a branch name, tag, or commit SHA.
   * Git will automatically determine the appropriate reference type.
   */
  ref?: string;
};

/**
 * Type definitions for Azure Pipeline YAML structures
 */

/**
 * Repository definition within Azure Pipeline resources
 */
export interface AzurePipelineRepository {
  repository?: string;
  name?: string;
  type?: string;
  ref?: string;
  endpoint?: string;
}

/**
 * Resources section of an Azure Pipeline YAML
 */
export interface AzurePipelineResources {
  repositories?: AzurePipelineRepository[];
  pipelines?: unknown[];
  containers?: unknown[];
}

/**
 * Basic structure of an Azure Pipeline YAML file
 */
export interface AzurePipelineYaml {
  resources?: AzurePipelineResources;
  trigger?: unknown;
  stages?: unknown[];
  jobs?: unknown[];
  steps?: unknown[];
  variables?: unknown;
  parameters?: unknown;
  pool?: unknown;
  extends?: unknown;
  [key: string]: unknown;
}

/**
 * Regular expression configurations for pipeline references
 */

/**
 * Typed RegExp pattern for local references to ensure regex returns the expected capture groups
 *
 * Capture groups:
 * 1. The target file path
 */
export type LocalReferencePattern = RegExp;

/**
 * Typed RegExp pattern for external references to ensure regex returns the expected capture groups
 *
 * Capture groups:
 * 1. The target file path
 * 2. The repository alias
 */
export type ExternalReferencePattern = RegExp;

/**
 * Regular expression patterns for finding local template references in pipeline files
 *
 * Each pattern must capture the target file path in the first capture group.
 */
export const LOCAL_REFERENCE_PATTERNS: LocalReferencePattern[] = [
  // template: filename.yml (key-value style)
  /template:\s*([^\s]+\.ya?ml)/gi,
  // extends: filename.yml
  /extends:\s*([^\s]+\.ya?ml)/gi,
  // template with file property: { file: filename.yml }
  /template:\s*.*?file:\s*([^\s]+\.ya?ml)/gi,
  // List item: - template: filename.yml
  /- template:\s*([^\s]+\.ya?ml)/gi,
  // List item with file property: - template: { file: filename.yml }
  /- template:\s*.*?file:\s*([^\s]+\.ya?ml)/gi,
];

/**
 * Regular expression patterns for finding references to templates in other repositories
 *
 * Each pattern must capture:
 * 1. The target file path
 * 2. The repository alias
 */
export const EXTERNAL_REFERENCE_PATTERNS: ExternalReferencePattern[] = [
  // Captures: template: filename.yml@reponame or template: path/to/filename.yml@reponame
  /template:\s*([^@\s\n]+)@([^:@\s\n]+)/gi,
  // Captures: - template: filename.yml@reponame or - template: path/to/filename.yml@reponame
  /- template:\s*([^@\s\n]+)@([^:@\s\n]+)/gi,
];
