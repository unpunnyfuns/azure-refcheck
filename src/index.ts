/**
 * Azure Pipeline Reference Validator
 *
 * A utility to validate references between Azure Pipeline YAML files,
 * ensuring that referenced templates and files exist, both within
 * a single repository and across multiple repositories.
 */

// Re-export validator function
export { validatePipelines } from "#validator";

// Re-export types
export type {
  PipelineReference,
  ValidationResult,
} from "#validator";
export type { RepoConfig } from "#config";

// Re-export file utilities
export {
  findPipelineFiles,
  fileExists,
  readFileContent,
} from "#utils/file";

// Re-export git utilities
export {
  validateRepoVersion,
  validateFileAtVersion,
} from "#utils/git";

// Export CLI utilities for summary generation
export { generateSummaryText } from "./cli.js";
