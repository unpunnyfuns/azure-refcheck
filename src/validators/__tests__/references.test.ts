import { describe, expect, test, vi } from "vitest";
import type { RepoConfig } from "#config";
import { collectAllReferences } from "#validators/references";

// Mock dependencies
vi.mock("#utils/file", () => ({
  findPipelineFiles: vi.fn(),
  readFileContent: vi.fn(),
}));

import { findPipelineFiles, readFileContent } from "#utils/file";

describe("References Module", () => {
  describe("collectAllReferences", () => {
    test("should skip repositories with skipValidation flag", () => {
      // Setup mock repositories
      const repoConfigs: RepoConfig[] = [
        { name: "repo1", path: "/path/to/repo1", aliases: [] },
        {
          name: "repo2",
          path: "/path/to/repo2",
          aliases: [],
          skipValidation: true,
        },
      ];

      // Setup mocks for the regular repo
      vi.mocked(findPipelineFiles).mockImplementation((path) => {
        if (path === "/path/to/repo1") {
          return ["/path/to/repo1/pipeline.yml"];
        }
        // Should not be called for repo2 with skipValidation
        throw new Error(
          `Unexpected call to findPipelineFiles with path ${path}`
        );
      });

      vi.mocked(readFileContent).mockReturnValue("template: test.yml");

      // Call the function
      collectAllReferences(repoConfigs);

      // Verify findPipelineFiles was only called for repo1
      expect(findPipelineFiles).toHaveBeenCalledTimes(1);
      expect(findPipelineFiles).toHaveBeenCalledWith("/path/to/repo1");
      expect(findPipelineFiles).not.toHaveBeenCalledWith("/path/to/repo2");
    });
  });
});
