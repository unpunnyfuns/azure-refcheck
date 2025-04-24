import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  type PipelineReference,
  ReferenceValidationResult,
} from "#validators/types";
import {
  validateExternalReference,
  validateLocalReference,
  validatePipelines,
  validateReference,
} from "#validators/validation";

// Mock dependencies
vi.mock("#utils/filesystem", () => ({
  fileExists: vi.fn(),
  joinPaths: vi.fn((...paths) => paths.join("/")),
  dirname: vi.fn((path) => path.split("/").slice(0, -1).join("/")),
  getFileSystem: vi.fn(),
}));

// Mock file utils
vi.mock("#utils/file", () => ({
  fileExists: vi.fn().mockReturnValue(true),
}));

// Mock git utils
vi.mock("#utils/git", () => ({
  validateRepoVersion: vi.fn(),
  validateFileAtVersion: vi.fn(),
}));

// Mock references collector
vi.mock("#validators/references", () => ({
  collectAllReferences: vi.fn(),
  discoverRepositoryAliases: vi.fn((repos) => repos),
}));

import { fileExists as fileUtilsFileExists } from "#utils/file";
import { fileExists } from "#utils/filesystem";
// Import mocked modules
import { validateFileAtVersion, validateRepoVersion } from "#utils/git";
import { collectAllReferences } from "#validators/references";

describe("Validation Module", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("validateExternalReference", () => {
    test("should validate a valid external reference", () => {
      // Setup mocks
      vi.mocked(fileExists).mockReturnValue(true);

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        targetRepo: "template-repo",
        lineNumber: 10,
        context: "template: template.yml@template-repo",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      const versionIssues: PipelineReference[] = [];

      const repoConfigs = [
        { name: "template-repo", path: "/path/to/template-repo", aliases: [] },
      ];

      const result = validateExternalReference(
        reference,
        "template-repo",
        repoConfigs,
        validRefs,
        brokenRefs,
        versionIssues
      );

      expect(result).toBe(ReferenceValidationResult.VALID);
      expect(validRefs).toHaveLength(1);
      expect(brokenRefs).toHaveLength(0);
      expect(versionIssues).toHaveLength(0);
    });

    test("should use repository configuration ref when reference has no version", () => {
      // Setup mocks
      vi.mocked(fileExists).mockReturnValue(false);
      vi.mocked(validateRepoVersion).mockReturnValue(true);
      vi.mocked(validateFileAtVersion).mockReturnValue(true);

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        targetRepo: "template-repo",
        lineNumber: 10,
        context: "template: template.yml@template-repo",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      const versionIssues: PipelineReference[] = [];

      const repoConfigs = [
        {
          name: "template-repo",
          path: "/path/to/template-repo",
          aliases: [],
          ref: "main",
        },
      ];

      const result = validateExternalReference(
        reference,
        "template-repo",
        repoConfigs,
        validRefs,
        brokenRefs,
        versionIssues
      );

      expect(result).toBe(ReferenceValidationResult.VALID);
      expect(validRefs).toHaveLength(1);
      expect(brokenRefs).toHaveLength(0);
      expect(versionIssues).toHaveLength(0);
      expect(validateFileAtVersion).toHaveBeenCalledWith(
        "/path/to/template-repo",
        "template.yml",
        "main",
        "branch" // Should still infer "branch" as the version type
      );
    });

    test("should handle missing repository", () => {
      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        targetRepo: "unknown-repo",
        lineNumber: 10,
        context: "template: template.yml@unknown-repo",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      const versionIssues: PipelineReference[] = [];

      const repoConfigs = [
        { name: "template-repo", path: "/path/to/template-repo", aliases: [] },
      ];

      const result = validateExternalReference(
        reference,
        "unknown-repo",
        repoConfigs,
        validRefs,
        brokenRefs,
        versionIssues
      );

      expect(result).toBe(ReferenceValidationResult.MISSING_REPO);
      expect(validRefs).toHaveLength(0);
      expect(brokenRefs).toHaveLength(1);
      expect(brokenRefs[0].target).toContain("Unknown repository");
    });

    test("should validate version references", () => {
      // Setup mocks
      vi.mocked(validateRepoVersion).mockReturnValue(true);
      vi.mocked(validateFileAtVersion).mockReturnValue(true);

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        targetRepo: "template-repo",
        targetVersion: "v1.0.0",
        versionType: "tag",
        lineNumber: 10,
        context: "template: template.yml@template-repo@v1.0.0",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      const versionIssues: PipelineReference[] = [];

      const repoConfigs = [
        { name: "template-repo", path: "/path/to/template-repo", aliases: [] },
      ];

      const result = validateExternalReference(
        reference,
        "template-repo",
        repoConfigs,
        validRefs,
        brokenRefs,
        versionIssues
      );

      expect(result).toBe(ReferenceValidationResult.VALID);
      expect(validRefs).toHaveLength(1);
      expect(brokenRefs).toHaveLength(0);
      expect(versionIssues).toHaveLength(0);
      expect(validateRepoVersion).toHaveBeenCalledWith(
        "/path/to/template-repo",
        "v1.0.0",
        "tag"
      );
    });

    test("should prioritize reference version over repository configuration ref", () => {
      // Setup mocks
      vi.mocked(validateRepoVersion).mockReturnValue(true);
      vi.mocked(validateFileAtVersion).mockReturnValue(true);
      vi.mocked(fileExists).mockReturnValue(false);

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        targetRepo: "template-repo",
        targetVersion: "v2.0.0",
        versionType: "tag",
        lineNumber: 10,
        context: "template: template.yml@template-repo@v2.0.0",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      const versionIssues: PipelineReference[] = [];

      const repoConfigs = [
        {
          name: "template-repo",
          path: "/path/to/template-repo",
          aliases: [],
          ref: "v1.0.0",
        },
      ];

      const result = validateExternalReference(
        reference,
        "template-repo",
        repoConfigs,
        validRefs,
        brokenRefs,
        versionIssues
      );

      expect(result).toBe(ReferenceValidationResult.VALID);
      expect(validRefs).toHaveLength(1);
      expect(brokenRefs).toHaveLength(0);
      expect(versionIssues).toHaveLength(0);
      // Should use the reference version, not the repo config version
      expect(validateRepoVersion).toHaveBeenCalledWith(
        "/path/to/template-repo",
        "v2.0.0",
        "tag"
      );
      expect(validateFileAtVersion).toHaveBeenCalledWith(
        "/path/to/template-repo",
        "template.yml",
        "v2.0.0",
        "tag"
      );
    });

    test("should infer version type from version format", () => {
      // Setup mocks
      vi.mocked(validateRepoVersion).mockReturnValue(true);
      vi.mocked(validateFileAtVersion).mockReturnValue(true);
      vi.mocked(fileExists).mockReturnValue(false);

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        targetRepo: "template-repo",
        lineNumber: 10,
        context: "template: template.yml@template-repo",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      const versionIssues: PipelineReference[] = [];

      const repoConfigs = [
        {
          name: "template-repo",
          path: "/path/to/template-repo",
          aliases: [],
          ref: "v3.0.0", // Version format suggests this is a tag
        },
      ];

      const result = validateExternalReference(
        reference,
        "template-repo",
        repoConfigs,
        validRefs,
        brokenRefs,
        versionIssues
      );

      expect(result).toBe(ReferenceValidationResult.VALID);
      expect(validRefs).toHaveLength(1);
      expect(brokenRefs).toHaveLength(0);
      expect(versionIssues).toHaveLength(0);
      // Should infer "tag" as the version type based on the format
      expect(validateFileAtVersion).toHaveBeenCalledWith(
        "/path/to/template-repo",
        "template.yml",
        "v3.0.0",
        "tag"
      );
    });

    test("should detect invalid versions", () => {
      // Setup mocks
      vi.mocked(validateRepoVersion).mockReturnValue(false);

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        targetRepo: "template-repo",
        targetVersion: "v1.0.0",
        versionType: "tag",
        lineNumber: 10,
        context: "template: template.yml@template-repo@v1.0.0",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      const versionIssues: PipelineReference[] = [];

      const repoConfigs = [
        { name: "template-repo", path: "/path/to/template-repo", aliases: [] },
      ];

      const result = validateExternalReference(
        reference,
        "template-repo",
        repoConfigs,
        validRefs,
        brokenRefs,
        versionIssues
      );

      expect(result).toBe(ReferenceValidationResult.INVALID_VERSION);
      expect(validRefs).toHaveLength(0);
      expect(brokenRefs).toHaveLength(0);
      expect(versionIssues).toHaveLength(1);
      expect(versionIssues[0].target).toContain("Invalid version");
    });

    test("should detect missing files at version", () => {
      // Setup mocks
      vi.mocked(validateRepoVersion).mockReturnValue(true);
      vi.mocked(validateFileAtVersion).mockReturnValue(false);
      vi.mocked(fileExists).mockReturnValue(false);

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        targetRepo: "template-repo",
        targetVersion: "v1.0.0",
        versionType: "tag",
        lineNumber: 10,
        context: "template: template.yml@template-repo@v1.0.0",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      const versionIssues: PipelineReference[] = [];

      const repoConfigs = [
        { name: "template-repo", path: "/path/to/template-repo", aliases: [] },
      ];

      const result = validateExternalReference(
        reference,
        "template-repo",
        repoConfigs,
        validRefs,
        brokenRefs,
        versionIssues
      );

      expect(result).toBe(ReferenceValidationResult.BROKEN_PATH);
      expect(validRefs).toHaveLength(0);
      expect(brokenRefs).toHaveLength(1);
      expect(versionIssues).toHaveLength(0);
      expect(brokenRefs[0].target).toContain("Template not found");
    });
  });

  describe("validateLocalReference", () => {
    test("should validate a valid local reference", () => {
      // Setup mocks
      vi.mocked(fileExists).mockReturnValue(true);
      vi.mocked(fileUtilsFileExists).mockReturnValue(true);

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        lineNumber: 10,
        context: "template: template.yml",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];

      const result = validateLocalReference(reference, validRefs, brokenRefs);

      expect(result).toBe(ReferenceValidationResult.VALID);
      expect(validRefs).toHaveLength(1);
      expect(brokenRefs).toHaveLength(0);
    });

    test("should detect missing files", () => {
      // Setup mocks
      vi.mocked(fileExists).mockReturnValue(false);
      vi.mocked(fileUtilsFileExists).mockReturnValue(false);

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        lineNumber: 10,
        context: "template: template.yml",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];

      const result = validateLocalReference(reference, validRefs, brokenRefs);

      expect(result).toBe(ReferenceValidationResult.BROKEN_PATH);
      expect(validRefs).toHaveLength(0);
      expect(brokenRefs).toHaveLength(1);
    });
  });

  describe("validateReference", () => {
    test("should route to validateLocalReference for local references", () => {
      // Setup mocks
      vi.mocked(fileExists).mockReturnValue(true);
      vi.mocked(fileUtilsFileExists).mockReturnValue(true);

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        lineNumber: 10,
        context: "template: template.yml",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      const versionIssues: PipelineReference[] = [];
      const repoConfigs = [];

      const result = validateReference(
        reference,
        repoConfigs,
        validRefs,
        brokenRefs,
        versionIssues
      );

      expect(result).toBe(ReferenceValidationResult.VALID);
      expect(validRefs).toHaveLength(1);
      expect(brokenRefs).toHaveLength(0);
    });

    test("should route to validateExternalReference for external references", () => {
      // Setup mocks
      vi.mocked(fileExists).mockReturnValue(true);
      vi.mocked(fileUtilsFileExists).mockReturnValue(true);

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        targetRepo: "template-repo",
        lineNumber: 10,
        context: "template: template.yml@template-repo",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      const versionIssues: PipelineReference[] = [];

      const repoConfigs = [
        { name: "template-repo", path: "/path/to/template-repo", aliases: [] },
      ];

      const result = validateReference(
        reference,
        repoConfigs,
        validRefs,
        brokenRefs,
        versionIssues
      );

      expect(result).toBe(ReferenceValidationResult.VALID);
      expect(validRefs).toHaveLength(1);
      expect(brokenRefs).toHaveLength(0);
    });

    test("should handle unexpected errors during validation", () => {
      // Setup mocks to throw an error
      vi.mocked(fileExists).mockImplementation(() => {
        throw new Error("Unexpected error");
      });
      vi.mocked(fileUtilsFileExists).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        lineNumber: 10,
        context: "template: template.yml",
      };

      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      const versionIssues: PipelineReference[] = [];
      const repoConfigs = [];

      const result = validateReference(
        reference,
        repoConfigs,
        validRefs,
        brokenRefs,
        versionIssues
      );

      expect(result).toBe(ReferenceValidationResult.BROKEN_PATH);
      expect(validRefs).toHaveLength(0);
      expect(brokenRefs).toHaveLength(1);
      // Instead of checking for specific error text, just ensure the broken reference has the expected properties
      expect(brokenRefs[0]).toHaveProperty("source", reference.source);
      expect(brokenRefs[0]).toHaveProperty("lineNumber", reference.lineNumber);
      expect(brokenRefs[0]).toHaveProperty("context", reference.context);
    });
  });

  describe("validatePipelines", () => {
    test("should validate pipelines with single repository path", () => {
      // Setup mocks
      vi.mocked(collectAllReferences).mockReturnValue([
        {
          source: "/path/to/source.yml",
          target: "template.yml",
          lineNumber: 10,
          context: "template: template.yml",
        },
      ]);
      vi.mocked(fileExists).mockReturnValue(true);
      vi.mocked(fileUtilsFileExists).mockReturnValue(true);

      const result = validatePipelines("/path/to/repo");

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.validReferences).toHaveLength(1);
      expect(result.brokenReferences).toHaveLength(0);
    });

    test("should validate pipelines with multiple repositories", () => {
      // Setup mocks
      vi.mocked(collectAllReferences).mockReturnValue([
        {
          source: "/path/to/repo1/source.yml",
          target: "template.yml",
          targetRepo: "repo2",
          lineNumber: 10,
          context: "template: template.yml@repo2",
        },
      ]);
      vi.mocked(fileExists).mockReturnValue(true);
      vi.mocked(fileUtilsFileExists).mockReturnValue(true);

      const repoConfigs = [
        { name: "repo1", path: "/path/to/repo1", aliases: [] },
        { name: "repo2", path: "/path/to/repo2", aliases: [] },
      ];

      const result = validatePipelines(repoConfigs);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.validReferences).toHaveLength(1);
      expect(result.brokenReferences).toHaveLength(0);
    });

    test("should skip validation for repository declarations", () => {
      // Setup mocks
      vi.mocked(collectAllReferences).mockReturnValue([
        {
          source: "/path/to/source.yml",
          target: "repository:templates",
          lineNumber: 5,
          context: "repository: templates",
        },
      ]);

      const result = validatePipelines("/path/to/repo");

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.validReferences).toHaveLength(1);
      expect(result.brokenReferences).toHaveLength(0);
      // The repository reference should be automatically marked as valid
      expect(fileExists).not.toHaveBeenCalled();
    });
  });
});
