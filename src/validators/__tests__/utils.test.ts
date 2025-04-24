import { execSync } from "node:child_process";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  findRepoConfig,
  getContextForMatch,
  getLineNumberForMatch,
  resolveTargetPath,
} from "#validators/utils";

// Mock child_process to avoid actual git commands
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Mock filesystem
vi.mock("#utils/filesystem", () => ({
  joinPaths: vi.fn((...paths) => path.join(...paths)),
  dirname: vi.fn((filePath) => path.dirname(filePath)),
  getFileSystem: vi.fn(),
}));

describe("Validator Utils", () => {
  describe("getLineNumberForMatch", () => {
    test("should return correct line number for a match", () => {
      const content = "line 1\nline 2\ntemplate: foo.yml\nline 4";
      const regex = /template:\s*([^\n]+)/g;
      const match = regex.exec(content);

      expect(match).not.toBeNull();
      if (match) {
        const lineNumber = getLineNumberForMatch(content, match);
        expect(lineNumber).toBe(3);
      }
    });

    test("should return 1 for match in the first line", () => {
      const content = "template: foo.yml\nline 2\nline 3";
      const regex = /template:\s*([^\n]+)/g;
      const match = regex.exec(content);

      expect(match).not.toBeNull();
      if (match) {
        const lineNumber = getLineNumberForMatch(content, match);
        expect(lineNumber).toBe(1);
      }
    });
  });

  describe("getContextForMatch", () => {
    test("should return the specified line with surrounding context", () => {
      const content = "line 1\nline 2\ntemplate: foo.yml\nline 4\nline 5";
      const lineNumber = 3;

      const context = getContextForMatch(content, lineNumber, 1);
      expect(context).toBe("line 2\ntemplate: foo.yml\nline 4");
    });

    test("should handle context at the beginning of file", () => {
      const content = "line 1\nline 2\nline 3";
      const lineNumber = 1;

      const context = getContextForMatch(content, lineNumber, 2);
      expect(context).toBe("line 1\nline 2\nline 3");
    });

    test("should handle context at the end of file", () => {
      const content = "line 1\nline 2\nline 3";
      const lineNumber = 3;

      const context = getContextForMatch(content, lineNumber, 2);
      expect(context).toBe("line 1\nline 2\nline 3");
    });

    test("should use default context size if not specified", () => {
      const content = "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7";
      const lineNumber = 4;

      const context = getContextForMatch(content, lineNumber);
      // Default is 2 lines before and after
      expect(context).toBe("line 2\nline 3\nline 4\nline 5\nline 6");
    });
  });

  describe("findRepoConfig", () => {
    test("should find repository by exact name", () => {
      const configs = [
        { name: "repo1", path: "/path/to/repo1", aliases: [] },
        { name: "repo2", path: "/path/to/repo2", aliases: ["r2"] },
      ];

      const result = findRepoConfig("repo2", configs);
      expect(result).toEqual(configs[1]);
    });

    test("should find repository by alias", () => {
      const configs = [
        { name: "repo1", path: "/path/to/repo1", aliases: ["r1", "main"] },
        { name: "repo2", path: "/path/to/repo2", aliases: ["r2"] },
      ];

      const result = findRepoConfig("main", configs);
      expect(result).toEqual(configs[0]);
    });

    test("should return undefined if repo not found", () => {
      const configs = [
        { name: "repo1", path: "/path/to/repo1", aliases: ["r1"] },
        { name: "repo2", path: "/path/to/repo2", aliases: ["r2"] },
      ];

      const result = findRepoConfig("unknown", configs);
      expect(result).toBeUndefined();
    });
  });

  describe("resolveTargetPath", () => {
    beforeEach(() => {
      // Reset mocks
      vi.resetAllMocks();
    });

    test("should resolve repository references as-is", () => {
      const result = resolveTargetPath(
        "/path/source.yml",
        "repository:templates",
        undefined
      );

      expect(result).toBe("repository:templates");
    });

    test("should resolve cross-repo references", () => {
      const repoConfigs = [
        {
          name: "template-repo",
          path: "/path/to/templates",
          aliases: ["templates"],
        },
      ];

      const result = resolveTargetPath(
        "/path/source.yml",
        "path/to/template.yml",
        "templates",
        repoConfigs
      );

      expect(result).toBe(
        path.normalize("/path/to/templates/path/to/template.yml")
      );
    });

    test("should handle absolute paths in cross-repo references", () => {
      const repoConfigs = [
        {
          name: "template-repo",
          path: "/path/to/templates",
          aliases: ["templates"],
        },
      ];

      const result = resolveTargetPath(
        "/path/source.yml",
        "/absolute/path/template.yml",
        "templates",
        repoConfigs
      );

      expect(result).toBe(
        path.normalize("/path/to/templates/absolute/path/template.yml")
      );
    });

    test("should return error format if repo not found", () => {
      const repoConfigs = [
        {
          name: "template-repo",
          path: "/path/to/templates",
          aliases: ["templates"],
        },
      ];

      const result = resolveTargetPath(
        "/path/source.yml",
        "path/to/template.yml",
        "unknown-repo",
        repoConfigs
      );

      expect(result).toBe("unknown-repo:path/to/template.yml");
    });

    test("should resolve absolute paths using git repo root", () => {
      // Mock git command to return repo root
      vi.mocked(execSync).mockReturnValue("/git/repo/root\n");

      const result = resolveTargetPath(
        "/git/repo/root/subdir/source.yml",
        "/absolute/path/template.yml"
      );

      expect(result).toBe(
        path.normalize("/git/repo/root/absolute/path/template.yml")
      );
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("git -C"),
        expect.any(Object)
      );
    });

    test("should handle relative paths to source file", () => {
      const result = resolveTargetPath(
        "/path/to/source.yml",
        "../templates/template.yml"
      );

      expect(result).toBe(path.normalize("/path/templates/template.yml"));
    });

    test("should fallback to cwd if git command fails", () => {
      // Mock git command to throw error
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("git command failed");
      });

      // Mock process.cwd
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue("/fallback/cwd");

      const result = resolveTargetPath(
        "/some/path/source.yml",
        "/absolute/path/template.yml"
      );

      expect(result).toBe(
        path.normalize("/fallback/cwd/absolute/path/template.yml")
      );

      // Restore process.cwd
      process.cwd = originalCwd;
    });
  });
});
