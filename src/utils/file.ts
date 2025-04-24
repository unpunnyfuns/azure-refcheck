import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import {
  fileExists as fsExists,
  readFile,
  writeFile as fsWrite,
  dirname,
  getFileSystem,
} from "./filesystem.js";

/**
 * Find all YAML pipeline files in a directory
 */
export function findPipelineFiles(rootDir: string): string[] {
  // If user specifies a specific directory path, respect that exactly
  // Only use global ignores like node_modules that should always be excluded

  const isExplicitPath = path.isAbsolute(rootDir) && process.cwd() !== rootDir;

  // Base ignore patterns (always ignore these)
  const ignorePatterns = ["**/node_modules/**", "**/bin/**", "**/obj/**"];

  // If we're not in an explicit path (we're at project root), also ignore test-fixtures
  // This prevents accidentally scanning test fixtures when running from project root
  if (!isExplicitPath) {
    // Only ignore test-fixtures when running from project root
    ignorePatterns.push("**/test-fixtures/**");
  }

  const options = {
    cwd: rootDir,
    ignore: ignorePatterns,
    absolute: true,
  };

  const yamlFiles = glob.sync("**/*.{yaml,yml}", options);
  return yamlFiles;
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fsExists(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * Read file content
 */
export function readFileContent(filePath: string): string {
  try {
    return readFile(filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error}`);
    return "";
  }
}

/**
 * Write content to a file
 */
export function writeFile(filePath: string, content: string): boolean {
  try {
    // Ensure directory exists
    const dirPath = dirname(filePath);
    if (!fsExists(dirPath)) {
      // For directory creation, we still need to use fs directly
      // since it's not part of our abstraction
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fsWrite(filePath, content);
    return true;
  } catch (error) {
    console.error(`Error writing to file ${filePath}: ${error}`);
    return false;
  }
}

/**
 * Get the file system instance
 * (Useful for tests that need to mock the file system)
 */
export function getFS() {
  return getFileSystem();
}
