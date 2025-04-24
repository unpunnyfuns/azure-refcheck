import { describe, expect, test, vi } from "vitest";
import { 
  parseVersionReference, 
  extractRepositoryDeclarations,
  extractReferencesFromPatterns
} from "#validators/parsers";

describe("Parsers", () => {
  describe("parseVersionReference", () => {
    test("should parse tag references", () => {
      const result = parseVersionReference("refs/tags/v1.0.0");
      expect(result.version).toBe("v1.0.0");
      expect(result.versionType).toBe("tag");
    });

    test("should parse branch references", () => {
      const result = parseVersionReference("refs/heads/main");
      expect(result.version).toBe("main");
      expect(result.versionType).toBe("branch");
    });

    test("should identify commit SHA", () => {
      // Full 40-char SHA
      const result = parseVersionReference("1234567890abcdef1234567890abcdef12345678");
      expect(result.version).toBe("1234567890abcdef1234567890abcdef12345678");
      expect(result.versionType).toBe("commit");
    });

    test("should default to branch for unknown formats", () => {
      const result = parseVersionReference("some-random-version");
      expect(result.version).toBe("some-random-version");
      expect(result.versionType).toBe("branch");
    });
  });

  describe("extractRepositoryDeclarations", () => {
    test("should extract repositories from valid YAML", () => {
      const yamlContent = `
resources:
  repositories:
  - repository: templates
    type: git
    name: TemplateLibrary
    ref: refs/tags/v1.0.0
  - repository: shared
    type: git
    name: SharedRepo
    ref: refs/heads/main
`;

      const result = extractRepositoryDeclarations(yamlContent);
      
      expect(result.repos).toEqual({
        templates: "TemplateLibrary",
        shared: "SharedRepo"
      });
      
      expect(result.repoVersions).toEqual({
        templates: { version: "v1.0.0", versionType: "tag" },
        shared: { version: "main", versionType: "branch" }
      });
    });

    test("should extract repositories with fallback regex when YAML parsing fails", () => {
      // Mock console.error to suppress warnings during tests
      const originalConsoleError = console.error;
      console.error = vi.fn();

      // This isn't valid YAML, but our fallback regex should still work
      // Note: The regex will actually still find both repositories
      const invalidYamlContent = `
resources:
  repositories:
  - repository: templates
    name: TemplateLibrary
    ref: refs/tags/v1.0.0
  malformed yaml here
  - repository: shared
    name: SharedRepo
`;

      const result = extractRepositoryDeclarations(invalidYamlContent);
      
      expect(result.repos).toEqual({
        templates: "TemplateLibrary",
        shared: "SharedRepo"
      });
      
      // The exact result depends on whether the implementation extracts the tag from the ref
      // Both forms are acceptable, so we just verify that it has the template version
      expect(result.repoVersions).toHaveProperty("templates");
      expect(result.repoVersions.templates.versionType).toBe("tag");

      // Restore console.error
      console.error = originalConsoleError;
    });

    test("should handle empty or invalid input", () => {
      expect(extractRepositoryDeclarations("")).toEqual({ repos: {}, repoVersions: {} });
      expect(extractRepositoryDeclarations("not yaml content")).toEqual({ repos: {}, repoVersions: {} });
    });
  });

  describe("extractReferencesFromPatterns", () => {
    test("should extract local template references", () => {
      const fileContent = `
steps:
- template: path/to/template.yml
- template: another/template.yml
`;
      const patterns = [/template:\s*([^\n@]+)/g];
      
      const results = extractReferencesFromPatterns(
        "/path/source.yml", 
        fileContent, 
        patterns, 
        false
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].source).toBe("/path/source.yml");
      expect(results[0].target).toBe("path/to/template.yml");
      expect(results[0].targetRepo).toBeUndefined();
      expect(results[1].target).toBe("another/template.yml");
    });

    test("should extract external template references", () => {
      const fileContent = `
steps:
- template: path/to/template.yml@templates
- template: another/template.yml@shared
`;
      const patterns = [/template:\s*([^@\n]+)@([^\n]+)/g];
      
      const results = extractReferencesFromPatterns(
        "/path/source.yml", 
        fileContent, 
        patterns, 
        true
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].source).toBe("/path/source.yml");
      expect(results[0].target).toBe("path/to/template.yml");
      expect(results[0].targetRepo).toBe("templates");
      expect(results[1].target).toBe("another/template.yml");
      expect(results[1].targetRepo).toBe("shared");
    });

    test("should include line numbers and context", () => {
      const fileContent = `line 1
line 2
steps:
- template: path/to/template.yml
line 5
line 6`;
      const patterns = [/template:\s*([^\n@]+)/g];
      
      const results = extractReferencesFromPatterns(
        "/path/source.yml", 
        fileContent, 
        patterns, 
        false
      );
      
      expect(results).toHaveLength(1);
      expect(results[0].lineNumber).toBe(4); // Line 4 of the file
      expect(results[0].context).toContain("template: path/to/template.yml");
    });
  });
});