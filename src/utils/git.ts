import child_process from "node:child_process";
import path from "node:path";
import fs from "node:fs";

/**
 * Get the Git repository root for a path
 */
export function getRepositoryRoot(filePath: string): string {
  try {
    return child_process
      .execSync(`git -C "${path.dirname(filePath)}" rev-parse --show-toplevel`, {
        encoding: "utf-8",
      })
      .trim();
  } catch (error) {
    console.error(`Error finding repository root: ${error}`);
    return "";
  }
}

/**
 * Check if a repository exists at the specified version
 */
export function validateRepoVersion(
  repoPath: string,
  version?: string,
  type?: "tag" | "branch" | "commit"
): boolean {
  if (!version) {
    return true; // No version specified, so it's valid
  }

  try {
    let command;

    switch (type) {
      case "tag":
        command = `git -C "${repoPath}" tag -l "${version}"`;
        break;
      case "branch":
        command = `git -C "${repoPath}" branch -a --list "*${version}*"`;
        break;
      case "commit":
        command = `git -C "${repoPath}" cat-file -t "${version}"`;
        break;
      default:
        // Default to branch
        command = `git -C "${repoPath}" branch -a --list "*${version}*"`;
    }

    const result = child_process.execSync(command, { encoding: "utf-8" }).trim();
    return result.length > 0;
  } catch (error) {
    console.error(`Error validating repository version: ${error}`);
    return false;
  }
}

/**
 * Check if a file exists at a specific repository version
 */
export function validateFileAtVersion(
  repoPath: string,
  filePath: string,
  version?: string,
  type?: "tag" | "branch" | "commit"
): boolean {
  if (!version) {
    // Just check if file exists normally
    try {
      const fullPath = path.join(
        repoPath,
        filePath.startsWith("/") ? filePath.substring(1) : filePath
      );
      return fs.existsSync(fullPath);
    } catch (error) {
      return false;
    }
  }

  try {
    // Make path relative to repo root
    let relPath = filePath;
    if (filePath.startsWith("/")) {
      relPath = filePath.substring(1);
    }

    // Use git to check if file exists at specific reference
    let refSpec;

    if (type === "tag") {
      refSpec = `refs/tags/${version}`;
    } else if (type === "branch") {
      // Try local branch first, then remote branches
      try {
        const result = child_process.execSync(
          `git -C "${repoPath}" cat-file -e refs/heads/${version}:${relPath}`,
          { stdio: "pipe" }
        );
        return true;
      } catch (e) {
        // Try remote branches
        try {
          const result = child_process.execSync(
            `git -C "${repoPath}" cat-file -e refs/remotes/origin/${version}:${relPath}`,
            { stdio: "pipe" }
          );
          return true;
        } catch (e2) {
          return false;
        }
      }
    } else {
      // Direct commit hash
      refSpec = version;
    }

    if (!refSpec) return false;

    child_process.execSync(`git -C "${repoPath}" cat-file -e ${refSpec}:${relPath}`, {
      stdio: "pipe",
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the content of a file at a specific repository version
 */
export function getFileContentAtVersion(
  repoPath: string,
  filePath: string,
  version: string,
  type: "tag" | "branch" | "commit"
): string | null {
  try {
    // Make path relative to repo root
    let relPath = filePath;
    if (filePath.startsWith("/")) {
      relPath = filePath.substring(1);
    }

    let refSpec;

    if (type === "tag") {
      refSpec = `refs/tags/${version}`;
    } else if (type === "branch") {
      refSpec = `refs/heads/${version}`;

      // Check if local branch exists, otherwise try remote
      try {
        child_process.execSync(`git -C "${repoPath}" show-ref --verify ${refSpec}`, {
          stdio: "pipe",
        });
      } catch (e) {
        refSpec = `refs/remotes/origin/${version}`;
      }
    } else {
      // Direct commit hash
      refSpec = version;
    }

    return child_process.execSync(`git -C "${repoPath}" show ${refSpec}:${relPath}`, {
      encoding: "utf-8",
    });
  } catch (error) {
    console.error(`Error getting file content at version: ${error}`);
    return null;
  }
}
