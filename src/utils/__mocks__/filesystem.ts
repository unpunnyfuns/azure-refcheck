/**
 * Mock implementation of filesystem.ts for testing
 */
import path from "node:path";
import fs from "node:fs";

export interface FileSystem {
  readFile(filePath: string): string;
  exists(filePath: string): boolean;
  realPath(filePath: string): string;
  writeFile(filePath: string, content: string): void;
  readDirectory(dirPath: string): string[];
  resolvePath(...pathSegments: string[]): string;
  relativePath(from: string, to: string): string;
  dirname(filePath: string): string;
  join(...paths: string[]): string;
  clearCache(): void;
}

export class MockFileSystem implements FileSystem {
  private mockFiles: Map<string, string> = new Map();
  private mockDirs: Set<string> = new Set();

  constructor(initialFiles: Record<string, string> = {}) {
    Object.entries(initialFiles).forEach(([path, content]) => {
      this.mockFiles.set(path, content);
      const dir = this.dirname(path);
      this.mockDirs.add(dir);
    });
  }

  readFile(filePath: string): string {
    if (this.mockFiles.has(filePath)) {
      return this.mockFiles.get(filePath) || "";
    }
    return fs.readFileSync(filePath, "utf-8");
  }

  exists(filePath: string): boolean {
    return (
      this.mockFiles.has(filePath) ||
      this.mockDirs.has(filePath) ||
      fs.existsSync(filePath)
    );
  }

  realPath(filePath: string): string {
    return filePath;
  }

  writeFile(filePath: string, content: string): void {
    this.mockFiles.set(filePath, content);
    const dir = this.dirname(filePath);
    this.mockDirs.add(dir);
  }

  readDirectory(dirPath: string): string[] {
    const result: string[] = [];
    this.mockFiles.forEach((_, path) => {
      if (path.startsWith(dirPath)) {
        const relativePath = path.slice(dirPath.length + 1);
        if (!relativePath.includes("/")) {
          result.push(relativePath);
        }
      }
    });
    return result;
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
    // No cache in mock system
  }
}

let mockFileSystem = new MockFileSystem();

export function configureFileSystem(fs: FileSystem): void {
  if (fs instanceof MockFileSystem) {
    mockFileSystem = fs;
  }
}

export function getFileSystem(): FileSystem {
  return mockFileSystem;
}

// Utility functions that use the mockFileSystem
export function readFile(filePath: string): string {
  return mockFileSystem.readFile(filePath);
}

export function fileExists(filePath: string): boolean {
  return mockFileSystem.exists(filePath);
}

export function realPath(filePath: string): string {
  return mockFileSystem.realPath(filePath);
}

export function writeFile(filePath: string, content: string): void {
  mockFileSystem.writeFile(filePath, content);
}

export function readDirectory(dirPath: string): string[] {
  return mockFileSystem.readDirectory(dirPath);
}

export function resolvePath(...pathSegments: string[]): string {
  return mockFileSystem.resolvePath(...pathSegments);
}

export function relativePath(from: string, to: string): string {
  return mockFileSystem.relativePath(from, to);
}

export function dirname(filePath: string): string {
  return mockFileSystem.dirname(filePath);
}

export function joinPaths(...paths: string[]): string {
  return mockFileSystem.join(...paths);
}

export function clearFileSystemCache(): void {
  mockFileSystem.clearCache();
}
