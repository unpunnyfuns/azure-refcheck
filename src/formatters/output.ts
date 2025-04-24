import path from "node:path";
import type { RepoConfig } from "#config";
import type { ValidationResult } from "#validator";
import type { PipelineReference } from "#validators/types";

/**
 * Output formatter options
 */
export interface FormatterOptions {
  verbose: boolean;
  workingDirectory?: string;
}

/**
 * Abstract base class for output formatters
 */
export abstract class OutputFormatter {
  protected options: FormatterOptions;

  constructor(options: FormatterOptions) {
    this.options = {
      ...options,
      workingDirectory: options.workingDirectory || process.cwd(),
    };
  }

  /**
   * Format validation result
   */
  public abstract format(
    result: ValidationResult,
    repoConfigs?: RepoConfig[]
  ): string;

  /**
   * Get relative path from working directory
   */
  protected getRelativePath(absolutePath: string): string {
    return path.relative(this.options.workingDirectory!, absolutePath);
  }

  /**
   * Find repository name for a file
   */
  protected findSourceRepo(
    sourcePath: string,
    repoConfigs: RepoConfig[]
  ): string {
    return (
      repoConfigs.find((r) => sourcePath.startsWith(r.path))?.name || "unknown"
    );
  }
}

/**
 * Console output formatter
 */
export class ConsoleFormatter extends OutputFormatter {
  /**
   * Format validation result for console output
   */
  public format(result: ValidationResult, repoConfigs?: RepoConfig[]): string {
    const hasMultipleRepos = !!repoConfigs && repoConfigs.length > 1;
    const totalRefs =
      result.validReferences.length + result.brokenReferences.length;
    const hasVersionIssues =
      result.versionIssues && result.versionIssues.length > 0;

    let output = "";

    // Title and status
    if (hasMultipleRepos) {
      output += "Azure Pipeline Multiple Repositories Validation Summary:\n";
    } else {
      output += "Azure Pipeline Validation Summary:\n";
    }

    // Basic statistics
    output += `- Status: ${result.isValid ? "✅ PASSED" : "❌ FAILED"}\n`;

    if (hasMultipleRepos) {
      output += `- Repositories analyzed: ${repoConfigs!.length}\n`;
    }

    output += `- Total references: ${totalRefs}${
      hasVersionIssues
        ? ` + ${result.versionIssues!.length} version references`
        : ""
    }\n`;
    output += `- Valid references: ${result.validReferences.length}\n`;
    output += `- Broken references: ${result.brokenReferences.length}\n`;

    if (hasVersionIssues) {
      output += `- Version issues: ${result.versionIssues!.length}\n`;
    }

    // Broken references
    if (result.brokenReferences.length > 0) {
      output += "\nBroken References:\n";
      result.brokenReferences.forEach((ref, index) => {
        output += this.formatReference(
          ref,
          index,
          repoConfigs,
          hasMultipleRepos
        );
      });
    }

    // Version issues
    if (hasVersionIssues) {
      output += "\nVersion Issues:\n";
      result.versionIssues!.forEach((ref, index) => {
        output += this.formatVersionIssue(
          ref,
          index,
          repoConfigs,
          hasMultipleRepos
        );
      });
    }

    return output;
  }

  /**
   * Format a single broken reference
   */
  private formatReference(
    ref: PipelineReference,
    index: number,
    repoConfigs?: RepoConfig[],
    hasMultipleRepos?: boolean
  ): string {
    let output = "\n";
    const relativePath = this.getRelativePath(ref.source);

    if (hasMultipleRepos && repoConfigs) {
      const sourceRepo = this.findSourceRepo(ref.source, repoConfigs);
      output += `${index + 1}. [${sourceRepo}] ${relativePath}\n`;
      output += `   Target: ${ref.target}${ref.targetRepo ? ` (in repo ${ref.targetRepo})` : ""}\n`;
    } else {
      output += `${index + 1}. ${relativePath} → ${ref.target}\n`;
    }

    output += `   Line: ${ref.lineNumber}\n`;

    // Show context only in verbose mode
    if (this.options.verbose) {
      output += `   Context:\n${ref.context}\n`;
    }

    return output;
  }

  /**
   * Format a single version issue
   */
  private formatVersionIssue(
    ref: PipelineReference,
    index: number,
    repoConfigs?: RepoConfig[],
    hasMultipleRepos?: boolean
  ): string {
    let output = "\n";
    const relativePath = this.getRelativePath(ref.source);

    if (hasMultipleRepos && repoConfigs) {
      const sourceRepo = this.findSourceRepo(ref.source, repoConfigs);
      output += `${index + 1}. [${sourceRepo}] ${relativePath}\n`;
    } else {
      output += `${index + 1}. ${relativePath}\n`;
    }

    output += `   Issue: ${ref.target}\n`;
    output += `   Line: ${ref.lineNumber}\n`;

    // Show context only in verbose mode
    if (this.options.verbose) {
      output += `   Context:\n${ref.context}\n`;
    }

    return output;
  }
}

/**
 * Markdown output formatter
 */
export class MarkdownFormatter extends OutputFormatter {
  /**
   * Format validation result for markdown output
   */
  public format(result: ValidationResult, repoConfigs?: RepoConfig[]): string {
    const hasMultipleRepos = !!repoConfigs && repoConfigs.length > 1;
    const totalRefs =
      result.validReferences.length + result.brokenReferences.length;
    const hasVersionIssues =
      result.versionIssues && result.versionIssues.length > 0;

    let output = "";

    // Title
    if (hasMultipleRepos) {
      output += "# Azure Pipeline Multiple Repositories Validation Summary\n\n";
    } else {
      output += "# Azure Pipeline Validation Summary\n\n";
    }

    // Status
    if (result.isValid) {
      output += "✅ All pipeline references are valid.\n\n";
    } else {
      output += `❌ Found ${result.brokenReferences.length} broken references${
        hasVersionIssues
          ? ` and ${result.versionIssues!.length} version issues`
          : ""
      }.\n\n`;
    }

    // Statistics
    if (hasMultipleRepos) {
      output += `Repositories analyzed: ${repoConfigs!.length}\n`;
    }

    output += `Total references: ${totalRefs}${
      hasVersionIssues
        ? ` + ${result.versionIssues!.length} version references`
        : ""
    }\n`;
    output += `Valid references: ${result.validReferences.length}\n`;
    output += `Broken references: ${result.brokenReferences.length}\n`;

    if (hasVersionIssues) {
      output += `Version issues: ${result.versionIssues!.length}\n`;
    }

    output += "\n";

    // Broken references details
    if (result.brokenReferences.length > 0) {
      output += "## Broken References\n\n";

      result.brokenReferences.forEach((ref, index) => {
        const relativePath = this.getRelativePath(ref.source);

        if (hasMultipleRepos && repoConfigs) {
          const sourceRepo = this.findSourceRepo(ref.source, repoConfigs);
          output += `### ${index + 1}. [${sourceRepo}] ${relativePath}\n\n`;
          output += `- Target: ${ref.target}${ref.targetRepo ? ` (in repo ${ref.targetRepo})` : ""}\n`;
        } else {
          output += `### ${index + 1}. ${relativePath} → ${ref.target}\n\n`;
        }

        output += `- Line: ${ref.lineNumber}\n`;
        output += `- Context:\n\`\`\`yaml\n${ref.context}\n\`\`\`\n\n`;
      });
    }

    // Version issues details
    if (hasVersionIssues) {
      output += "## Version Issues\n\n";

      result.versionIssues!.forEach((ref, index) => {
        const relativePath = this.getRelativePath(ref.source);

        if (hasMultipleRepos && repoConfigs) {
          const sourceRepo = this.findSourceRepo(ref.source, repoConfigs);
          output += `### ${index + 1}. [${sourceRepo}] ${relativePath}\n\n`;
        } else {
          output += `### ${index + 1}. ${relativePath}\n\n`;
        }

        output += `- Issue: ${ref.target}\n`;
        output += `- Line: ${ref.lineNumber}\n`;
        output += `- Context:\n\`\`\`yaml\n${ref.context}\n\`\`\`\n\n`;
      });
    }

    return output;
  }
}

/**
 * Factory for creating output formatters
 */
export class FormatterFactory {
  /**
   * Create console output formatter
   */
  public static createConsoleFormatter(
    options: FormatterOptions
  ): ConsoleFormatter {
    return new ConsoleFormatter(options);
  }

  /**
   * Create markdown output formatter
   */
  public static createMarkdownFormatter(
    options: FormatterOptions
  ): MarkdownFormatter {
    return new MarkdownFormatter(options);
  }
}
