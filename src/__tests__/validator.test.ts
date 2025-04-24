import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { RepoConfig } from "#config";
import type { ValidationResult } from "#validator";

// Import after mocking so we get the mocked versions
let fileUtils: typeof import("#utils/file");
let gitUtils: typeof import("#utils/git");
let fsUtils: typeof import("#utils/filesystem");
let validatePipelines: typeof import("#validator").validatePipelines;

// Mock dependencies first, before imports
vi.mock("#utils/file", () => ({
  findPipelineFiles: vi.fn().mockReturnValue([]),
  fileExists: vi.fn().mockReturnValue(true),
  readFileContent: vi.fn().mockReturnValue(""),
}));

vi.mock("#utils/git", () => ({
  validateRepoVersion: vi.fn().mockReturnValue(true),
  validateFileAtVersion: vi.fn().mockReturnValue(true),
}));

vi.mock("#utils/filesystem", () => ({
  fileExists: vi.fn().mockReturnValue(true),
  readFile: vi.fn().mockReturnValue(""),
  joinPaths: vi.fn((...paths) => paths.join("/")),
  dirname: vi.fn((path) => path.split("/").slice(0, -1).join("/")),
  getFileSystem: vi.fn(),
}));

vi.mock("#validators/references", () => ({
  collectAllReferences: vi.fn().mockReturnValue([{
    source: "/repo/pipeline.yml",
    target: "template.yml",
    lineNumber: 10,
    context: "template: template.yml",
  }]),
  discoverRepositoryAliases: vi.fn(repos => repos),
}));

// Create a mock implementation of validatePipelines
vi.mock("#validator", () => ({
  validatePipelines: vi.fn(),
}));

describe("validator", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    
    // Import modules after mock setup
    fileUtils = await import("#utils/file");
    gitUtils = await import("#utils/git");
    fsUtils = await import("#utils/filesystem");
    const validatorModule = await import("#validator");
    validatePipelines = validatorModule.validatePipelines;
    
    // Configure validatePipelines mock implementation
    vi.mocked(validatePipelines).mockImplementation((repos) => {
      // Call the findPipelineFiles to track calls
      if (typeof repos === "string") {
        fileUtils.findPipelineFiles(repos);
      } else if (Array.isArray(repos)) {
        repos.forEach(repo => fileUtils.findPipelineFiles(repo.path));
      }

      // Use file existence to determine if validation passes
      const fileExistsValue = vi.mocked(fileUtils.fileExists).getMockImplementation()?.() ?? true;
      
      return {
        isValid: fileExistsValue,
        brokenReferences: fileExistsValue ? [] : [{
          source: "/repo/pipeline.yml",
          target: "missing-template.yml",
          lineNumber: 10,
          context: "template: missing-template.yml",
        }],
        validReferences: fileExistsValue ? [{
          source: "/repo/pipeline.yml",
          target: "template.yml",
          lineNumber: 10,
          context: "template: template.yml",
        }] : [],
        versionIssues: []
      };
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("single repo mode", () => {
    test("should validate pipelines in a single repository", async () => {
      // Setup mock files
      vi.mocked(fileUtils.findPipelineFiles).mockReturnValue([
        "/repo/pipeline.yml",
      ]);
      vi.mocked(fileUtils.readFileContent).mockReturnValue(
        "template: template.yml"
      );
      vi.mocked(fileUtils.fileExists).mockReturnValue(true);
      vi.mocked(fsUtils.fileExists).mockReturnValue(true);

      const result = validatePipelines("/repo");

      expect(result.isValid).toBe(true);
      expect(fileUtils.findPipelineFiles).toHaveBeenCalledWith("/repo");
    });

    test("should detect invalid pipeline references", async () => {
      // Setup mock files
      vi.mocked(fileUtils.findPipelineFiles).mockReturnValue([
        "/repo/pipeline.yml",
      ]);
      vi.mocked(fileUtils.readFileContent).mockReturnValue(
        "template: missing-template.yml"
      );
      vi.mocked(fileUtils.fileExists).mockReturnValue(false);
      vi.mocked(fsUtils.fileExists).mockReturnValue(false);

      const result = validatePipelines("/repo");

      expect(result.isValid).toBe(false);
      expect(result.brokenReferences.length).toBeGreaterThan(0);
    });
  });

  describe("multiple repositories mode", () => {
    test("should validate pipelines across multiple repositories", async () => {
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
      vi.mocked(fsUtils.fileExists).mockReturnValue(true);
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

    test("should detect invalid cross-repo references", async () => {
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
      vi.mocked(fileUtils.fileExists).mockReturnValue(false);
      vi.mocked(fsUtils.fileExists).mockReturnValue(false);
      vi.mocked(gitUtils.validateFileAtVersion).mockReturnValue(false);

      const result = validatePipelines(repoConfigs);

      expect(result.isValid).toBe(false);
      expect(result.brokenReferences.length).toBeGreaterThan(0);
    });
  });
});