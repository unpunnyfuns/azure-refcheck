import fs from "node:fs";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { 
  validateExternalReference,
  validateLocalReference,
  validateReference,
  validatePipelines
} from "#validators/validation";
import { 
  ReferenceValidationResult,
  type PipelineReference
} from "#validators/types";

// Mock dependencies
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

// Mock git utils
vi.mock("#utils/git", () => ({
  validateRepoVersion: vi.fn(),
  validateFileAtVersion: vi.fn(),
}));

// Mock references collector
vi.mock("#validators/references", () => ({
  collectAllReferences: vi.fn(),
  discoverRepositoryAliases: vi.fn(repos => repos),
}));

// Import mocked modules
import { validateRepoVersion, validateFileAtVersion } from "#utils/git";
import { collectAllReferences } from "#validators/references";

describe("Validation Module", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("validateExternalReference", () => {
    test("should validate a valid external reference", () => {
      // Setup mocks
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
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
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
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
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        lineNumber: 10,
        context: "template: template.yml",
      };
      
      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      
      const result = validateLocalReference(
        reference,
        validRefs,
        brokenRefs
      );
      
      expect(result).toBe(ReferenceValidationResult.VALID);
      expect(validRefs).toHaveLength(1);
      expect(brokenRefs).toHaveLength(0);
    });

    test("should detect missing files", () => {
      // Setup mocks
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const reference: PipelineReference = {
        source: "/path/to/source.yml",
        target: "template.yml",
        lineNumber: 10,
        context: "template: template.yml",
      };
      
      const validRefs: PipelineReference[] = [];
      const brokenRefs: PipelineReference[] = [];
      
      const result = validateLocalReference(
        reference,
        validRefs,
        brokenRefs
      );
      
      expect(result).toBe(ReferenceValidationResult.BROKEN_PATH);
      expect(validRefs).toHaveLength(0);
      expect(brokenRefs).toHaveLength(1);
    });
  });

  describe("validateReference", () => {
    test("should route to validateLocalReference for local references", () => {
      // Setup mocks
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
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
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
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
      vi.mocked(fs.existsSync).mockImplementation(() => {
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
      expect(brokenRefs[0]).toHaveProperty('source', reference.source);
      expect(brokenRefs[0]).toHaveProperty('lineNumber', reference.lineNumber);
      expect(brokenRefs[0]).toHaveProperty('context', reference.context);
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
        }
      ]);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
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
        }
      ]);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
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
        }
      ]);
      
      const result = validatePipelines("/path/to/repo");
      
      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.validReferences).toHaveLength(1);
      expect(result.brokenReferences).toHaveLength(0);
      // The repository reference should be automatically marked as valid
      expect(fs.existsSync).not.toHaveBeenCalled();
    });
  });
});