import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { RepoConfig } from "#config";
import * as fileUtils from "#utils/file";
import * as gitUtils from "#utils/git";
import { type ValidationResult, validatePipelines } from "#validator";

// Mock dependencies
vi.mock("#utils/file", () => ({
  findPipelineFiles: vi.fn(),
  fileExists: vi.fn(),
  readFileContent: vi.fn(),
}));

vi.mock("#utils/git", () => ({
  validateRepoVersion: vi.fn(),
  validateFileAtVersion: vi.fn(),
}));

// No more report module to mock

describe("validator", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("single repo mode", () => {
    test("should validate pipelines in a single repository", () => {
      // Setup mock files
      vi.mocked(fileUtils.findPipelineFiles).mockReturnValue([
        "/repo/pipeline.yml",
      ]);
      vi.mocked(fileUtils.readFileContent).mockReturnValue(
        "template: template.yml"
      );
      vi.mocked(fileUtils.fileExists).mockReturnValue(true);

      const result = validatePipelines("/repo");

      expect(result.isValid).toBe(true);
      expect(fileUtils.findPipelineFiles).toHaveBeenCalledWith("/repo");
    });

    test("should detect invalid pipeline references", () => {
      // Setup mock files
      vi.mocked(fileUtils.findPipelineFiles).mockReturnValue([
        "/repo/pipeline.yml",
      ]);
      vi.mocked(fileUtils.readFileContent).mockReturnValue(
        "template: missing-template.yml"
      );
      vi.mocked(fileUtils.fileExists).mockReturnValue(false);

      const result = validatePipelines("/repo");

      expect(result.isValid).toBe(false);
      expect(result.brokenReferences.length).toBeGreaterThan(0);
    });
  });

  describe("multiple repositories mode", () => {
    test("should validate pipelines across multiple repositories", () => {
      // Define repo configs
      const repoConfigs: RepoConfig[] = [
        { name: "repo1", path: "/path/to/repo1", aliases: [] },
        { name: "repo2", path: "/path/to/repo2", aliases: ["templates"] },
      ];

      // Setup mock files
      vi.mocked(fileUtils.findPipelineFiles).mockReturnValue([
        "/path/to/repo1/pipeline.yml",
      ]);
      vi.mocked(fileUtils.readFileContent).mockReturnValue(
        "template: template.yml@repo2"
      );
      vi.mocked(fileUtils.fileExists).mockReturnValue(true);
      vi.mocked(gitUtils.validateFileAtVersion).mockReturnValue(true);

      const result = validatePipelines(repoConfigs);

      expect(result.isValid).toBe(true);
      expect(fileUtils.findPipelineFiles).toHaveBeenCalledWith(
        "/path/to/repo1"
      );
      expect(fileUtils.findPipelineFiles).toHaveBeenCalledWith(
        "/path/to/repo2"
      );
    });

    test("should detect invalid cross-repo references", () => {
      // Define repo configs
      const repoConfigs: RepoConfig[] = [
        { name: "repo1", path: "/path/to/repo1", aliases: [] },
        { name: "repo2", path: "/path/to/repo2", aliases: ["templates"] },
      ];

      // Setup mock files with broken reference
      vi.mocked(fileUtils.findPipelineFiles).mockReturnValue([
        "/path/to/repo1/pipeline.yml",
      ]);
      vi.mocked(fileUtils.readFileContent).mockReturnValue(
        "template: missing-template.yml@repo2"
      );
      vi.mocked(gitUtils.validateFileAtVersion).mockReturnValue(false);

      const result = validatePipelines(repoConfigs);

      expect(result.isValid).toBe(false);
      expect(result.brokenReferences.length).toBeGreaterThan(0);
    });
  });
});
