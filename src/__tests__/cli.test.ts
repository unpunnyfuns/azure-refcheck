import path from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { RepoConfig } from "../config.js";
import type { PipelineReference, ValidationResult } from "../validator.js";

// Mock dependencies to prevent actual execution
vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn().mockImplementation((path) => {
      if (path instanceof URL && path.toString().includes("package.json")) {
        return '{"version":"1.0.0"}';
      }
      return '{"repositories":[]}';
    }),
    realpathSync: vi.fn().mockReturnValue(""),
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    readdirSync: vi.fn().mockReturnValue([]),
  }
}));

vi.mock("commander", () => {
  const mockCommand = {
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    argument: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnThis(),
    command: vi.fn().mockReturnThis(),
    parseAsync: vi.fn().mockResolvedValue({}),
    help: vi.fn(),
    hook: vi.fn().mockReturnThis(),
    opts: vi.fn().mockReturnValue({}),
  };

  return {
    Command: vi.fn().mockImplementation(() => mockCommand),
  };
});

vi.mock("#validator", () => ({
  validatePipelines: vi.fn().mockReturnValue({
    isValid: true,
    validReferences: [],
    brokenReferences: [],
  }),
}));

// Helper functions for creating test-specific mocks
// Note: These are defined AFTER the vi.mock calls because vi.mock is hoisted
const createBaseFsMock = (overrides = {}) => ({
  readFileSync: vi.fn().mockImplementation((path) => {
    if (path instanceof URL && path.toString().includes("package.json")) {
      return '{"version":"1.0.0"}';
    }
    return '{"repositories":[]}';
  }),
  realpathSync: vi.fn().mockReturnValue(""),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  readdirSync: vi.fn().mockReturnValue([]),
  ...overrides,
});

// Mock process.exit
const originalExit = process.exit;

// Mock process.cwd for consistent path resolution in tests
const originalCwd = process.cwd;

describe("CLI Module Tests", () => {
  beforeEach(() => {
    // Mock process.exit
    process.exit = vi.fn() as any;

    // Reset argv for each test
    process.argv = ["node", "script.js"];

    // Mock process.cwd for testing
    process.cwd = () => "/test/cwd";

    // Clear module cache to reload with new mocks
    vi.resetModules();
  });

  afterEach(() => {
    // Restore process.exit
    process.exit = originalExit;

    // Restore process.cwd
    process.cwd = originalCwd;

    // Clear all mocks
    vi.clearAllMocks();
  });

  test("Should exist and export expected functions", async () => {
    // Import the CLI module
    const cli = await import("#cli");

    // Verify the module loaded and exports expected functions
    expect(cli).toBeDefined();
    expect(cli.setupCommands).toBeDefined();
    expect(cli.autoDetectRepositories).toBeDefined();
    expect(cli.loadRepoConfig).toBeDefined();
  });

  test("loadRepoConfig should validate repository config", async () => {
    // Reset modules to clear imports
    vi.resetModules();

    // Create a customized mock for this test using the base mock
    const fsMock = createBaseFsMock({
      readFileSync: vi.fn().mockReturnValue(
        JSON.stringify({
          repositories: [{ name: "test-repo", path: "./test" }],
        })
      ),
    });

    vi.doMock("fs", () => ({ default: fsMock }));

    const { loadRepoConfig } = await import("#cli");
    const result = loadRepoConfig("/path/to/config.json");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("test-repo");
    // Should resolve relative paths
    expect(result[0].path).toContain("/path/to/test");
  });

  test("loadRepoConfig should throw error for invalid config", async () => {
    // Reset modules to clear imports
    vi.resetModules();

    // Create a customized mock for this test using the base mock
    const fsMock = createBaseFsMock({
      readFileSync: vi.fn().mockReturnValue('{"repositories": "not-an-array"}'),
    });

    vi.doMock("fs", () => ({ default: fsMock }));

    const { loadRepoConfig } = await import("#cli");

    expect(() => loadRepoConfig("/path/to/config.json")).toThrow(
      "Invalid configuration format: expected a { repositories: [] } object"
    );
  });

  test("setupCommands should create a Command instance", async () => {
    const { setupCommands } = await import("#cli");
    const program = setupCommands();

    expect(program).toBeDefined();
    expect(vi.mocked(Command).mock.instances.length).toBeGreaterThan(0);
  });

  describe("Summary Generation", () => {
    test("should generate a basic summary for valid results", async () => {
      const { generateSummaryText } = await import("#cli");

      const result: ValidationResult = {
        isValid: true,
        validReferences: [
          {
            source: "/test/cwd/src/pipeline.yml",
            target: "template.yml",
            lineNumber: 10,
            context: "template: template.yml",
          },
        ],
        brokenReferences: [],
      };

      const summary = generateSummaryText(result);

      expect(summary).toContain("# Azure Pipeline Validation Summary");
      expect(summary).toContain("✅ All pipeline references are valid");
      expect(summary).toContain("Total references: 1");
      expect(summary).toContain("Valid references: 1");
      expect(summary).toContain("Broken references: 0");
      expect(summary).not.toContain("## Broken References");
    });

    test("should generate summary with broken references", async () => {
      const { generateSummaryText } = await import("#cli");

      const brokenRef: PipelineReference = {
        source: "/test/cwd/src/pipeline.yml",
        target: "missing.yml",
        lineNumber: 20,
        context: "template: missing.yml",
      };

      const result: ValidationResult = {
        isValid: false,
        validReferences: [],
        brokenReferences: [brokenRef],
      };

      const summary = generateSummaryText(result);

      expect(summary).toContain("# Azure Pipeline Validation Summary");
      expect(summary).toContain("❌ Found 1 broken references");
      expect(summary).toContain("Total references: 1");
      expect(summary).toContain("Valid references: 0");
      expect(summary).toContain("Broken references: 1");
      expect(summary).toContain("## Broken References");
      expect(summary).toContain("### 1. src/pipeline.yml → missing.yml");
      expect(summary).toContain("- Line: 20");
      expect(summary).toContain("```yaml\ntemplate: missing.yml\n```");
    });

    test("should generate multiple repositories summary with version issues", async () => {
      const { generateSummaryText } = await import("#cli");

      const repoConfigs: RepoConfig[] = [
        { name: "main-repo", path: "/test/cwd/main-repo", aliases: [] },
        {
          name: "template-repo",
          path: "/test/cwd/template-repo",
          aliases: ["templates"],
        },
      ];

      const brokenRef: PipelineReference = {
        source: "/test/cwd/main-repo/pipeline.yml",
        target: "missing.yml",
        targetRepo: "template-repo",
        lineNumber: 5,
        context: "template: missing.yml@template-repo",
      };

      const versionIssue: PipelineReference = {
        source: "/test/cwd/main-repo/pipeline.yml",
        target: "Invalid version v1.0.0 in repo template-repo",
        targetRepo: "template-repo",
        targetVersion: "v1.0.0",
        versionType: "tag",
        lineNumber: 15,
        context: "template: template.yml@template-repo@v1.0.0",
      };

      const result: ValidationResult = {
        isValid: false,
        validReferences: [],
        brokenReferences: [brokenRef],
        versionIssues: [versionIssue],
      };

      const summary = generateSummaryText(result, repoConfigs);

      expect(summary).toContain(
        "# Azure Pipeline Multiple Repositories Validation Summary"
      );
      expect(summary).toContain(
        "❌ Found 1 broken references and 1 version issues"
      );
      expect(summary).toContain("Repositories analyzed: 2");
      expect(summary).toContain("Total references: 1 + 1 version references");
      expect(summary).toContain("Version issues: 1");

      // Broken references section
      expect(summary).toContain("## Broken References");
      expect(summary).toContain("### 1. [main-repo] main-repo/pipeline.yml");
      expect(summary).toContain(
        "- Target: missing.yml (in repo template-repo)"
      );

      // Version issues section
      expect(summary).toContain("## Version Issues");
      expect(summary).toContain("### 1. [main-repo] main-repo/pipeline.yml");
      expect(summary).toContain(
        "- Issue: Invalid version v1.0.0 in repo template-repo"
      );
    });
  });
});
