import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  fileExists,
  findPipelineFiles,
  readFileContent,
  writeFile,
} from "#utils/file";

// Import glob before mock so we can spy on it
import * as globModule from "glob";

// Mock dependencies
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}));

// Create a mock for glob
vi.mock("glob", () => ({
  glob: {
    sync: vi.fn(),
  },
}));

// Mock filesystem.js module
vi.mock("../filesystem.js", () => ({
  fileExists: vi.fn((path) => fs.existsSync(path)),
  readFile: vi.fn((path) => fs.readFileSync(path, "utf-8")),
  writeFile: vi.fn((path, content) => fs.writeFileSync(path, content)),
  dirname: vi.fn(path.dirname),
  getFileSystem: vi.fn(),
}));

describe("file-utils", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("findPipelineFiles", () => {
    test("should find all YAML pipeline files in a directory", () => {
      // Setup mock
      const mockSync = vi
        .fn()
        .mockReturnValue([
          "/repo/pipeline1.yml",
          "/repo/pipeline2.yaml",
          "/repo/subdir/pipeline3.yml",
        ]);

      // Temporarily replace the mocked method
      const originalSync = globModule.glob.sync;
      // @ts-ignore - Using any to bypass type checking for the mock
      globModule.glob.sync = mockSync;

      const result = findPipelineFiles("/repo");

      expect(result).toEqual([
        "/repo/pipeline1.yml",
        "/repo/pipeline2.yaml",
        "/repo/subdir/pipeline3.yml",
      ]);

      expect(mockSync).toHaveBeenCalledWith("**/*.{yaml,yml}", {
        cwd: "/repo",
        ignore: ["**/node_modules/**", "**/bin/**", "**/obj/**"],
        absolute: true,
      });

      // Restore the original method
      globModule.glob.sync = originalSync;
    });

    test("should return empty array if no files found", () => {
      // Setup mock
      const mockSync = vi.fn().mockReturnValue([]);

      // Temporarily replace the mocked method
      const originalSync = globModule.glob.sync;
      // @ts-ignore - Using any to bypass type checking for the mock
      globModule.glob.sync = mockSync;

      const result = findPipelineFiles("/empty-repo");

      expect(result).toEqual([]);

      // Restore the original method
      globModule.glob.sync = originalSync;
    });
  });

  describe("fileExists", () => {
    test("should return true if file exists", () => {
      // Setup mock
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = fileExists("/path/to/file.yml");

      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith("/path/to/file.yml");
    });

    test("should return false if file does not exist", () => {
      // Setup mock
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = fileExists("/path/to/nonexistent.yml");

      expect(result).toBe(false);
    });

    test("should return false if an error occurs", () => {
      // Setup mock to throw error
      vi.mocked(fs.existsSync).mockImplementation(() => {
        throw new Error("Access denied");
      });

      const result = fileExists("/inaccessible/path.yml");

      expect(result).toBe(false);
    });
  });

  describe("readFileContent", () => {
    test("should read file content", () => {
      // Setup mock
      const mockContent = "File content";
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);

      const result = readFileContent("/path/to/file.yml");

      expect(result).toBe(mockContent);
      expect(fs.readFileSync).toHaveBeenCalledWith(
        "/path/to/file.yml",
        "utf-8"
      );
    });

    test("should return empty string if an error occurs", () => {
      // Setup mock to throw error
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("File not found");
      });
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = readFileContent("/nonexistent/file.yml");

      expect(result).toBe("");
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("writeFile", () => {
    test("should write content to file", () => {
      // Setup mocks
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      const result = writeFile("/path/to/file.yml", "Content");

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "/path/to/file.yml",
        "Content"
      );
    });

    test("should create directory if it does not exist", () => {
      // Setup mocks
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
      vi.spyOn(path, "dirname").mockReturnValue("/path/to");

      const result = writeFile("/path/to/file.yml", "Content");

      expect(result).toBe(true);
      expect(fs.mkdirSync).toHaveBeenCalledWith("/path/to", {
        recursive: true,
      });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "/path/to/file.yml",
        "Content"
      );
    });

    test("should return false if an error occurs", () => {
      // Setup mock to throw error
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = writeFile("/protected/file.yml", "Content");

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
