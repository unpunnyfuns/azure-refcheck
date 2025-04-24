/**
 * Filesystem abstraction for improved caching and testability
 */

import fs from "node:fs";
import path from "node:path";
import { FileNotFoundError } from "#errors";

/**
 * Interface for file system operations
 */
export interface FileSystem {
  /**
   * Read a file and return its contents as a string
   */
  readFile(filePath: string): string;

  /**
   * Check if a file exists
   */
  exists(filePath: string): boolean;

  /**
   * Get real path of a file, resolving symlinks
   */
  realPath(filePath: string): string;

  /**
   * Write content to a file
   */
  writeFile(filePath: string, content: string): void;

  /**
   * Read directory contents
   */
  readDirectory(dirPath: string): string[];

  /**
   * Resolve path
   */
  resolvePath(...pathSegments: string[]): string;

  /**
   * Get relative path
   */
  relativePath(from: string, to: string): string;

  /**
   * Get directory name from path
   */
  dirname(filePath: string): string;

  /**
   * Join path segments
   */
  join(...paths: string[]): string;

  /**
   * Clear any caches (if implemented)
   */
  clearCache(): void;
}

/**
 * Real filesystem implementation that directly uses node:fs
 */
export class RealFileSystem implements FileSystem {
  readFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new FileNotFoundError(filePath);
      }
      throw error;
    }
  }

  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  realPath(filePath: string): string {
    return fs.realpathSync(filePath);
  }

  writeFile(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content);
  }

  readDirectory(dirPath: string): string[] {
    return fs.readdirSync(dirPath);
  }

  resolvePath(...pathSegments: string[]): string {
    return path.resolve(...pathSegments);
  }

  relativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  join(...paths: string[]): string {
    return path.join(...paths);
  }

  clearCache(): void {
    // No cache to clear in the real filesystem
  }
}

/**
 * Caching file system that reduces redundant I/O operations
 */
export class CachingFileSystem implements FileSystem {
  private readonly fs: FileSystem;
  private readonly contentCache = new Map<string, string>();
  private readonly existsCache = new Map<string, boolean>();

  constructor(fs: FileSystem = new RealFileSystem()) {
    this.fs = fs;
  }

  readFile(filePath: string): string {
    const absPath = this.resolvePath(filePath);

    if (this.contentCache.has(absPath)) {
      return this.contentCache.get(absPath)!;
    }

    const content = this.fs.readFile(absPath);
    this.contentCache.set(absPath, content);
    this.existsCache.set(absPath, true);

    return content;
  }

  exists(filePath: string): boolean {
    const absPath = this.resolvePath(filePath);

    if (this.existsCache.has(absPath)) {
      return this.existsCache.get(absPath)!;
    }

    const exists = this.fs.exists(absPath);
    this.existsCache.set(absPath, exists);

    return exists;
  }

  realPath(filePath: string): string {
    return this.fs.realPath(filePath);
  }

  writeFile(filePath: string, content: string): void {
    const absPath = this.resolvePath(filePath);

    this.fs.writeFile(absPath, content);

    // Update caches
    this.contentCache.set(absPath, content);
    this.existsCache.set(absPath, true);
  }

  readDirectory(dirPath: string): string[] {
    return this.fs.readDirectory(dirPath);
  }

  resolvePath(...pathSegments: string[]): string {
    return this.fs.resolvePath(...pathSegments);
  }

  relativePath(from: string, to: string): string {
    return this.fs.relativePath(from, to);
  }

  dirname(filePath: string): string {
    return this.fs.dirname(filePath);
  }

  join(...paths: string[]): string {
    return this.fs.join(...paths);
  }

  clearCache(): void {
    this.contentCache.clear();
    this.existsCache.clear();
  }
}

/**
 * Global file system instance that can be configured
 */
let globalFileSystem: FileSystem = new CachingFileSystem();

/**
 * Configure the global file system
 */
export function configureFileSystem(fs: FileSystem): void {
  globalFileSystem = fs;
}

/**
 * Get the global file system
 */
export function getFileSystem(): FileSystem {
  return globalFileSystem;
}

/**
 * Utility function to read a file
 */
export function readFile(filePath: string): string {
  return globalFileSystem.readFile(filePath);
}

/**
 * Utility function to check if a file exists
 */
export function fileExists(filePath: string): boolean {
  return globalFileSystem.exists(filePath);
}

/**
 * Utility function to get real path
 */
export function realPath(filePath: string): string {
  return globalFileSystem.realPath(filePath);
}

/**
 * Utility function to write to a file
 */
export function writeFile(filePath: string, content: string): void {
  globalFileSystem.writeFile(filePath, content);
}

/**
 * Utility function to read a directory
 */
export function readDirectory(dirPath: string): string[] {
  return globalFileSystem.readDirectory(dirPath);
}

/**
 * Resolve path using the global file system
 */
export function resolvePath(...pathSegments: string[]): string {
  return globalFileSystem.resolvePath(...pathSegments);
}

/**
 * Get relative path using the global file system
 */
export function relativePath(from: string, to: string): string {
  return globalFileSystem.relativePath(from, to);
}

/**
 * Get directory name using the global file system
 */
export function dirname(filePath: string): string {
  return globalFileSystem.dirname(filePath);
}

/**
 * Join paths using the global file system
 */
export function joinPaths(...paths: string[]): string {
  return globalFileSystem.join(...paths);
}

/**
 * Clear the file system cache
 */
export function clearFileSystemCache(): void {
  globalFileSystem.clearCache();
}
