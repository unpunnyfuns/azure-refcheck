#!/usr/bin/env node

import fs, { type PathLike } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { type ValidationResult, validatePipelines } from "#validator";
import type { RepoConfig } from "./config.js";

// Setup version from package.json
const packageJson = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

// Create commander program
const program = new Command();

/**
 * Auto-detects Git repositories in the specified directory
 *
 * @param basePath - Base directory to scan for repositories
 * @returns Array of repository configurations
 */
function autoDetectRepositories(basePath: string): RepoConfig[] {
  console.log(`Auto-detecting Git repositories in ${basePath}...`);

  const repos: RepoConfig[] = [];
  try {
    const entries = fs.readdirSync(basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(basePath, entry.name);

        // Check if this is a Git repository
        if (fs.existsSync(path.join(dirPath, ".git"))) {
          console.log(`Found Git repository: ${entry.name}`);

          repos.push({
            name: entry.name,
            path: dirPath,
            aliases: [entry.name.replace(/-/g, "_")],
          });
        }
      }
    }

    console.log(`Auto-detected ${repos.length} repositories`);
  } catch (error) {
    console.error(`Error scanning directory ${basePath}:`, error);
    throw new Error(`Failed to scan directory: ${basePath}`);
  }

  return repos;
}

/**
 * Loads repository configuration from a JSON file
 *
 * @param configPath - Path to the configuration file
 * @returns Array of repository configurations
 */
function loadRepoConfig(configPath: string): RepoConfig[] {
  try {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent);

    // Expect a standard format with a repositories array
    const repos = config.repositories;

    if (!Array.isArray(repos)) {
      throw new Error(
        "Invalid configuration format: expected a { repositories: [] } object"
      );
    }

    // Validate each repository configuration
    for (const repo of repos) {
      if (!repo.name) {
        throw new Error('Each repository must have a "name" property');
      }
      if (!repo.path) {
        throw new Error('Each repository must have a "path" property');
      }

      // Resolve relative paths
      if (!path.isAbsolute(repo.path)) {
        repo.path = path.resolve(path.dirname(configPath), repo.path);
      }
    }

    return repos;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${configPath}`);
    }
    throw error;
  }
}

/**
 * Runs validation in single repository mode
 */

async function runSingleRepoValidation(options: {
  rootDir: string;
  outputPath?: string;
  verbose: boolean;
}) {
  const { rootDir, outputPath, verbose } = options;

  // Ensure the directory exists
  if (!fs.existsSync(rootDir)) {
    console.error(`Directory not found: ${rootDir}`);
    process.exit(1);
  }

  // Get absolute path to ensure proper resolution
  const absoluteRootDir = path.resolve(rootDir);

  if (verbose) {
    // Make it clear if we're validating a specific subdirectory
    const isSpecificDir =
      absoluteRootDir !== process.cwd() &&
      absoluteRootDir.startsWith(process.cwd());
    if (isSpecificDir) {
      console.log(
        `Validating Azure Pipeline references in specific directory: ${absoluteRootDir}`
      );
    } else {
      console.log(
        `Validating Azure Pipeline references in: ${absoluteRootDir}`
      );
    }

    if (outputPath) {
      console.log(`Summary will be saved to ${outputPath}`);
    }
    console.log(`Node.js version: ${process.version}`);
    console.log(`Working directory: ${process.cwd()}`);
  }

  try {
    const result = validatePipelines(absoluteRootDir);

    // Save summary to file if output path is specified
    if (outputPath) {
      const summaryText = generateSummaryText(result);
      fs.writeFileSync(outputPath, summaryText);
      console.log(`Summary saved to ${outputPath}`);
    }

    // Always show basic summary
    const totalRefs =
      result.validReferences.length + result.brokenReferences.length;
    console.log("Azure Pipeline Validation Summary:");
    console.log(`- Status: ${result.isValid ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`- Total references: ${totalRefs}`);
    console.log(`- Valid references: ${result.validReferences.length}`);
    console.log(`- Broken references: ${result.brokenReferences.length}`);

    // Always show details of broken references
    if (result.brokenReferences.length > 0) {
      console.log("\nBroken References:");
      result.brokenReferences.forEach((ref, index) => {
        const relativePath = path.relative(process.cwd(), ref.source);
        console.log(`\n${index + 1}. ${relativePath} → ${ref.target}`);
        console.log(`   Line: ${ref.lineNumber}`);
        // Show context only in verbose mode
        if (verbose) {
          console.log(`   Context:\n${ref.context}`);
        }
      });
    }

    return result.isValid ? 0 : 1;
  } catch (error) {
    console.error("Error validating pipeline references:", error);
    return 1;
  }
}

/**
 * Runs validation across multiple repositories
 */
async function runRepositoriesValidation(options: {
  configPath?: string;
  autoDetect: boolean;
  basePath: string;
  outputPath?: string;
  verbose: boolean;
}) {
  const { configPath, autoDetect, basePath, outputPath, verbose } = options;
  let repoConfigs: RepoConfig[] = [];

  // Get repository configs from auto-detection or config file
  if (autoDetect) {
    try {
      repoConfigs = autoDetectRepositories(basePath);

      // Save detected repos to a config file if output path is specified
      if (outputPath && repoConfigs.length > 0) {
        const detectedConfigPath = path.join(
          path.dirname(outputPath),
          "detected-repos.json"
        );
        fs.writeFileSync(
          detectedConfigPath,
          JSON.stringify({ repositories: repoConfigs }, null, 2)
        );
        console.log(`Saved detected repositories to ${detectedConfigPath}`);
      }
    } catch (error) {
      console.error("Error auto-detecting repositories:", error);
      return 1;
    }
  } else if (configPath) {
    try {
      repoConfigs = loadRepoConfig(configPath);
    } catch (error) {
      console.error("Error loading repository configuration:", error);
      return 1;
    }
  } else {
    console.error("No repository configuration or auto-detection specified.");
    program.help();
    return 1;
  }

  if (repoConfigs.length === 0) {
    console.error("No repositories found or configured.");
    return 1;
  }

  // Print info if verbose
  if (verbose) {
    console.log(`Validating ${repoConfigs.length} repositories:`);
    repoConfigs.forEach((repo) => {
      console.log(`- ${repo.name}: ${repo.path}`);
    });
    console.log(`Node.js version: ${process.version}`);
    console.log(`Working directory: ${process.cwd()}`);
  }

  try {
    // Run validation
    const result = validatePipelines(repoConfigs);

    // Save summary to file if output path is specified
    if (outputPath) {
      const summaryText = generateSummaryText(result, repoConfigs);
      fs.writeFileSync(outputPath, summaryText);
      console.log(`Summary saved to ${outputPath}`);
    }

    // Always show basic summary
    const totalRefs =
      result.validReferences.length + result.brokenReferences.length;
    const hasVersionIssues =
      result.versionIssues && result.versionIssues.length > 0;

    console.log("\nAzure Pipeline Multiple Repositories Validation Summary:");
    console.log(`- Status: ${result.isValid ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`- Repositories analyzed: ${repoConfigs.length}`);
    console.log(
      `- Total references: ${totalRefs}${
        hasVersionIssues
          ? ` + ${result.versionIssues!.length} version references`
          : ""
      }`
    );
    console.log(`- Valid references: ${result.validReferences.length}`);
    console.log(`- Broken references: ${result.brokenReferences.length}`);
    if (hasVersionIssues) {
      console.log(`- Version issues: ${result.versionIssues!.length}`);
    }

    // Always show broken references details
    if (result.brokenReferences.length > 0) {
      console.log("\nBroken References:");
      result.brokenReferences.forEach((ref, index) => {
        const relativePath = path.relative(process.cwd(), ref.source);
        const sourceRepo =
          repoConfigs.find((r) => ref.source.startsWith(r.path))?.name ||
          "unknown";
        console.log(`\n${index + 1}. [${sourceRepo}] ${relativePath}`);
        console.log(
          `   Target: ${ref.target}${
            ref.targetRepo ? ` (in repo ${ref.targetRepo})` : ""
          }`
        );
        console.log(`   Line: ${ref.lineNumber}`);
        // Show context only in verbose mode
        if (verbose) {
          console.log(`   Context:\n${ref.context}`);
        }
      });
    }

    // Always show version issues
    if (hasVersionIssues) {
      console.log("\nVersion Issues:");
      result.versionIssues!.forEach((ref, index) => {
        const relativePath = path.relative(process.cwd(), ref.source);
        const sourceRepo =
          repoConfigs.find((r) => ref.source.startsWith(r.path))?.name ||
          "unknown";
        console.log(`\n${index + 1}. [${sourceRepo}] ${relativePath}`);
        console.log(`   Issue: ${ref.target}`);
        console.log(`   Line: ${ref.lineNumber}`);
        // Show context only in verbose mode
        if (verbose) {
          console.log(`   Context:\n${ref.context}`);
        }
      });
    }

    return result.isValid ? 0 : 1;
  } catch (error) {
    console.error("Error validating pipeline references:", error);
    return 1;
  }
}

/**
 * Setup the CLI commands and options
 */
function setupCommands() {
  program
    .name("azrefcheck")
    .description(
      "Azure Pipeline Reference Validator - Validates references between pipeline YAML files"
    )
    .version(packageJson.version);

  // Unified command for both single repo and multiple repos
  program
    .argument(
      "[path]",
      "Directory to validate (or path to config.json file)",
      process.cwd()
    )
    .option(
      "-o, --output <path>",
      "Path to save the validation summary as markdown"
    )
    .option("-v, --verbose", "Enable verbose output", false)
    .option("-c, --config <path>", "Path to multi-repo configuration JSON file")
    .option(
      "-a, --auto-detect",
      "Enable multi-repo mode: auto-detect Git repositories in the specified directory",
      false
    )
    .option(
      "-b, --base-path <path>",
      "Base path for multi-repo auto-detection (only used with --auto-detect)",
      process.cwd()
    )
    .action(async (pathArg, options) => {
      // If a specific path is provided (not the default cwd), and it's not a config file,
      // then we should validate just that path directly, even with auto-detect
      const userSpecifiedPath = pathArg !== process.cwd();
      const isConfigFile = pathArg.endsWith(".json") && fs.existsSync(pathArg);

      // Determine if we're in multiple repositories mode, but only if:
      // 1. User explicitly used --config or --auto-detect options
      // 2. Path is a JSON file (config)
      const isMultipleRepos =
        options.config !== undefined ||
        (options.autoDetect === true && !userSpecifiedPath) || // Only use auto-detect in multi-repo mode if no specific path
        isConfigFile;

      let exitCode;

      if (isMultipleRepos) {
        // Configuration file path - either from argument or option
        const configFile = pathArg.endsWith(".json") ? pathArg : undefined;
        const configPath = options.config || configFile;

        // When auto-detecting repos, we need to be explicit about which path to use
        const autoDetectBasePath = options.basePath
          ? path.resolve(options.basePath)
          : userSpecifiedPath
            ? path.resolve(pathArg)
            : process.cwd();

        exitCode = await runRepositoriesValidation({
          configPath: configPath ? path.resolve(configPath) : undefined,
          autoDetect: options.autoDetect,
          basePath: autoDetectBasePath,
          outputPath: options.output ? path.resolve(options.output) : undefined,
          verbose: options.verbose,
        });
      } else {
        // Single repository mode
        exitCode = await runSingleRepoValidation({
          rootDir: path.resolve(pathArg),
          outputPath: options.output ? path.resolve(options.output) : undefined,
          verbose: options.verbose,
        });
      }

      process.exit(exitCode);
    });

  // No need for separate commands

  return program;
}

/**
 * Main entry point
 */
async function main() {
  const program = setupCommands();
  await program.parseAsync(process.argv);
}

// Only run the main function when this module is executed directly (not imported in tests)
// For ESM modules, use import.meta.url to check if this is the main module
import * as url from "node:url";

if (import.meta.url.startsWith("file:")) {
  const modulePath = url.fileURLToPath(import.meta.url);
  const mainPath = fs.realpathSync(process.argv[1] as PathLike);
  if (mainPath === modulePath) {
    main().catch((error) => {
      console.error("Unhandled error:", error);
      process.exit(1);
    });
  }
}

/**
 * Generates a markdown summary text for the validation result
 *
 * @param result - Validation result
 * @param repoConfigs - Optional repository configurations for multiple repositories
 * @returns Markdown formatted summary
 */
function generateSummaryText(
  result: ValidationResult,
  repoConfigs?: RepoConfig[]
): string {
  let summary = "";
  const hasMultipleRepos = !!repoConfigs && repoConfigs.length > 1;
  const totalRefs =
    result.validReferences.length + result.brokenReferences.length;
  const hasVersionIssues =
    result.versionIssues && result.versionIssues.length > 0;

  // Title
  if (hasMultipleRepos) {
    summary += "# Azure Pipeline Multiple Repositories Validation Summary\n\n";
  } else {
    summary += "# Azure Pipeline Validation Summary\n\n";
  }

  // Status
  if (result.isValid) {
    summary += "✅ All pipeline references are valid.\n\n";
  } else {
    summary += `❌ Found ${result.brokenReferences.length} broken references${
      hasVersionIssues
        ? ` and ${result.versionIssues!.length} version issues`
        : ""
    }.\n\n`;
  }

  // Statistics
  if (hasMultipleRepos) {
    summary += `Repositories analyzed: ${repoConfigs!.length}\n`;
  }

  summary += `Total references: ${totalRefs}${
    hasVersionIssues
      ? ` + ${result.versionIssues!.length} version references`
      : ""
  }\n`;
  summary += `Valid references: ${result.validReferences.length}\n`;
  summary += `Broken references: ${result.brokenReferences.length}\n`;

  if (hasVersionIssues) {
    summary += `Version issues: ${result.versionIssues!.length}\n`;
  }

  summary += "\n";

  // Broken references details
  if (result.brokenReferences.length > 0) {
    summary += "## Broken References\n\n";

    result.brokenReferences.forEach((ref, index) => {
      const relativePath = path.relative(process.cwd(), ref.source);

      if (hasMultipleRepos) {
        const sourceRepo =
          repoConfigs!.find((r) => ref.source.startsWith(r.path))?.name ||
          "unknown";
        summary += `### ${index + 1}. [${sourceRepo}] ${relativePath}\n\n`;
        summary += `- Target: ${ref.target}${
          ref.targetRepo ? ` (in repo ${ref.targetRepo})` : ""
        }\n`;
      } else {
        summary += `### ${index + 1}. ${relativePath} → ${ref.target}\n\n`;
      }

      summary += `- Line: ${ref.lineNumber}\n`;
      summary += `- Context:\n\`\`\`yaml\n${ref.context}\n\`\`\`\n\n`;
    });
  }

  // Version issues details
  if (hasVersionIssues) {
    summary += "## Version Issues\n\n";

    result.versionIssues!.forEach((ref, index) => {
      const relativePath = path.relative(process.cwd(), ref.source);

      if (hasMultipleRepos) {
        const sourceRepo =
          repoConfigs!.find((r) => ref.source.startsWith(r.path))?.name ||
          "unknown";
        summary += `### ${index + 1}. [${sourceRepo}] ${relativePath}\n\n`;
      } else {
        summary += `### ${index + 1}. ${relativePath}\n\n`;
      }

      summary += `- Issue: ${ref.target}\n`;
      summary += `- Line: ${ref.lineNumber}\n`;
      summary += `- Context:\n\`\`\`yaml\n${ref.context}\n\`\`\`\n\n`;
    });
  }

  return summary;
}

// Export for testing
export {
  setupCommands,
  autoDetectRepositories,
  loadRepoConfig,
  generateSummaryText,
};
