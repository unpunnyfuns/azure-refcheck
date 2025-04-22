import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { RepoConfig } from "#config";

/**
 * Extracts the line number for a regex match in text
 *
 * @param fileContent - Source text content
 * @param match - Regular expression match result
 * @returns Line number (1-based) where the match appears
 */
export function getLineNumberForMatch(fileContent: string, match: RegExpExecArray): number {
  const textBeforeMatch = fileContent.substring(0, match.index);
  return textBeforeMatch.split("\n").length;
}

/**
 * Extracts surrounding context lines for a given line in text
 *
 * @param fileContent - Source text content
 * @param lineNumber - The line number to get context for (1-based)
 * @param contextLines - Number of lines to include before and after (default: 2)
 * @returns Text containing the specified line and surrounding context
 */
export function getContextForMatch(
  fileContent: string,
  lineNumber: number,
  contextLines = 2
): string {
  const lines = fileContent.split("\n");
  const startLine = Math.max(0, lineNumber - 1 - contextLines);
  const endLine = Math.min(lines.length, lineNumber + contextLines);

  return lines.slice(startLine, endLine).join("\n");
}

/**
 * Find a repository configuration by name or alias
 *
 * @param repoName - Repository name or alias to find
 * @param configs - Array of repository configurations to search
 * @returns Matching repository configuration or undefined if not found
 */
export function findRepoConfig(repoName: string, configs: RepoConfig[]): RepoConfig | undefined {
  // First, try exact name match
  let config = configs.find((r) => r.name === repoName);

  // If not found, try aliases
  if (!config) {
    config = configs.find((r) => r.aliases?.includes(repoName));
  }

  return config;
}

/**
 * Resolve target path, handling both single-repo and cross-repo references
 *
 * @param sourcePath - Path to the source file containing the reference
 * @param targetPath - Target path referenced in the source
 * @param targetRepo - Optional target repository name
 * @param repoConfigs - Optional array of repository configurations
 * @returns Resolved file system path
 */
export function resolveTargetPath(
  sourcePath: string,
  targetPath: string,
  targetRepo?: string,
  repoConfigs?: RepoConfig[]
): string {
  // Handle repository references
  if (targetPath.startsWith("repository:")) {
    return targetPath; // Keep as is, just for reporting
  }

  // Handle cross-repo references
  if (targetRepo && repoConfigs) {
    const repoConfig = findRepoConfig(targetRepo, repoConfigs);
    if (repoConfig?.path) {
      // If target path is absolute (from repo root), or repo-relative
      if (targetPath.startsWith("/")) {
        return path.normalize(path.join(repoConfig.path, targetPath.substring(1)));
      }
      return path.normalize(path.join(repoConfig.path, targetPath));
    }

    // If repo not found, return original for error reporting
    return `${targetRepo}:${targetPath}`;
  }

  // Handle normal relative or absolute paths
  if (targetPath.startsWith("/")) {
    // Try to determine repository root - use a safer path resolution approach
    try {
      // Use path module to safely handle directory names that might contain special characters
      const sourceDir = path.dirname(sourcePath);
      
      // Use git -C for correct directory context
      const repoRoot = execSync(`git -C "${sourceDir}" rev-parse --show-toplevel`, {
        encoding: "utf-8",
        timeout: 3000, // 3 second timeout
      }).trim();

      return path.normalize(path.join(repoRoot, targetPath.substring(1)));
    } catch (error) {
      // Log the error with better context
      if (process.env.NODE_ENV !== "test") {
        console.error(`Failed to resolve repository root for ${sourcePath}: ${error}`);
      }
      // Fallback to current working directory
      return path.normalize(path.join(process.cwd(), targetPath));
    }
  }

  // Relative path to source file
  return path.normalize(path.join(path.dirname(sourcePath), targetPath));
}