import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

/**
 * Find all YAML pipeline files in a directory
 */
export function findPipelineFiles(rootDir: string): string[] {
  // If user specifies a specific directory path, respect that exactly
  // Only use global ignores like node_modules that should always be excluded
  
  const isExplicitPath = path.isAbsolute(rootDir) && process.cwd() !== rootDir;
  
  // Base ignore patterns (always ignore these)
  const ignorePatterns = [
    "**/node_modules/**", 
    "**/bin/**", 
    "**/obj/**"
  ];
  
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
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * Read file content
 */
export function readFileContent(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
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
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, content);
    return true;
  } catch (error) {
    console.error(`Error writing to file ${filePath}: ${error}`);
    return false;
  }
}
