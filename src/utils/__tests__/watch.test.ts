import { describe, expect, test, vi } from "vitest";
import { watchRepositories } from "#utils/watch";

// Mock chokidar
vi.mock("chokidar", () => ({
  default: {
    watch: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      close: vi.fn(),
    }),
  },
}));

// Mock filesystem
vi.mock("#utils/filesystem", () => ({
  getFileSystem: vi.fn().mockReturnValue({
    clearCache: vi.fn(),
  }),
}));

// Mock file functions
vi.mock("#utils/file", () => ({
  findPipelineFiles: vi
    .fn()
    .mockReturnValue([
      "/path/to/repo/pipeline.yml",
      "/path/to/repo/templates/template.yml",
    ]),
}));

// Mock validation
vi.mock("#validator", () => ({
  validatePipelines: vi.fn().mockReturnValue({
    isValid: true,
    brokenReferences: [],
    validReferences: [{ source: "test.yml", target: "template.yml" }],
  }),
}));

import chokidar from "chokidar";
import { findPipelineFiles } from "#utils/file";
import { getFileSystem } from "#utils/filesystem";
import { validatePipelines } from "#validator";

describe("Watch Functionality", () => {
  test("watchRepositories sets up file watching correctly for single repo", () => {
    // Clear mock calls
    vi.clearAllMocks();

    // Call watch function
    const stopWatching = watchRepositories("/path/to/repo", {
      verbose: true,
      onValidation: vi.fn(),
    });

    // Verify chokidar.watch was called with the correct paths
    expect(findPipelineFiles).toHaveBeenCalledWith("/path/to/repo");
    expect(chokidar.watch).toHaveBeenCalledWith(
      ["/path/to/repo/pipeline.yml", "/path/to/repo/templates/template.yml"],
      expect.objectContaining({
        persistent: true,
        ignoreInitial: true,
      })
    );

    // Verify validation ran initially
    expect(validatePipelines).toHaveBeenCalledWith("/path/to/repo");

    // Verify we can stop watching
    expect(typeof stopWatching).toBe("function");
    stopWatching();
  });

  test("watchRepositories sets up file watching correctly for multiple repos", () => {
    // Clear mock calls
    vi.clearAllMocks();

    const repoConfigs = [
      { name: "repo1", path: "/path/to/repo1", aliases: [] },
      { name: "repo2", path: "/path/to/repo2", aliases: [] },
    ];

    // Mock findPipelineFiles to return different values for different repos
    vi.mocked(findPipelineFiles).mockImplementation((path) => {
      if (path === "/path/to/repo1") {
        return ["/path/to/repo1/pipeline.yml"];
      }
      return ["/path/to/repo2/pipeline.yml", "/path/to/repo2/template.yml"];
    });

    // Call watch function
    const stopWatching = watchRepositories(repoConfigs, {
      verbose: true,
      onValidation: vi.fn(),
    });

    // Verify findPipelineFiles was called for each repo
    expect(findPipelineFiles).toHaveBeenCalledWith("/path/to/repo1");
    expect(findPipelineFiles).toHaveBeenCalledWith("/path/to/repo2");

    // Verify chokidar.watch was called with all paths combined
    expect(chokidar.watch).toHaveBeenCalledWith(
      [
        "/path/to/repo1/pipeline.yml",
        "/path/to/repo2/pipeline.yml",
        "/path/to/repo2/template.yml",
      ],
      expect.any(Object)
    );

    // Verify validation ran initially
    expect(validatePipelines).toHaveBeenCalledWith(repoConfigs);

    // Verify we can stop watching
    stopWatching();
  });
});
