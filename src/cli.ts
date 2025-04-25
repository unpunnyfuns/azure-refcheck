#!/usr/bin/env node

import fs, { type PathLike } from "node:fs";
import path from "node:path";
import * as url from "node:url";
import { Command } from "commander";
import type { RepoConfig } from "#config";
import {
  AzureRefCheckError,
  ConfigurationError,
  DirectoryNotFoundError,
  handleError,
} from "#errors";
import { type ConsoleFormatter, FormatterFactory } from "#formatters/output";
import type { FormatterOptions } from "#formatters/output";
import { watchRepositories } from "#utils/watch";
import { type ValidationResult, validatePipelines } from "#validator";

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
    throw new DirectoryNotFoundError(basePath);
  }

  return repos;
}

/**
 * Loads repository configuration from a JSON file
 *
 * @param configPath - Path to the configuration file
 * @returns Array of repository configurations
 * @throws ConfigurationError if configuration is invalid
 */
function loadRepoConfig(configPath: string): RepoConfig[] {
  try {
    if (!fs.existsSync(configPath)) {
      throw new ConfigurationError(
        `Configuration file not found: ${configPath}`
      );
    }

    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent);

    // Expect a standard format with a repositories array
    const repos = config.repositories;

    if (!Array.isArray(repos)) {
      throw new ConfigurationError(
        "Invalid configuration format: expected a { repositories: [] } object"
      );
    }

    // Validate each repository configuration
    for (const repo of repos) {
      if (!repo.name) {
        throw new ConfigurationError(
          'Each repository must have a "name" property'
        );
      }
      if (!repo.path) {
        throw new ConfigurationError(
          'Each repository must have a "path" property'
        );
      }

      // Resolve relative paths
      if (!path.isAbsolute(repo.path)) {
        repo.path = path.resolve(path.dirname(configPath), repo.path);
      }
    }

    return repos;
  } catch (error) {
    if (error instanceof AzureRefCheckError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new ConfigurationError(
        `Invalid JSON in configuration file: ${configPath}`
      );
    }

    throw new ConfigurationError(
      `Error loading configuration: ${String(error)}`
    );
  }
}

/**
 * Validates a directory exists
 *
 * @param dirPath - Directory path to validate
 * @returns Absolute path to the directory
 * @throws DirectoryNotFoundError if directory doesn't exist
 */
function validateDirectory(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    throw new DirectoryNotFoundError(dirPath);
  }

  return path.resolve(dirPath);
}

/**
 * Logs validation environment information in verbose mode
 *
 * @param options - Options object
 * @param rootDir - Directory being validated
 */
function logVerboseInfo(
  options: { verbose: boolean; outputPath?: string },
  rootDir: string
): void {
  if (!options.verbose) return;

  const absoluteRootDir = path.resolve(rootDir);

  // Make it clear if we're validating a specific subdirectory
  const isSpecificDir =
    absoluteRootDir !== process.cwd() &&
    absoluteRootDir.startsWith(process.cwd());

  if (isSpecificDir) {
    console.log(
      `Validating Azure Pipeline references in specific directory: ${absoluteRootDir}`
    );
  } else {
    console.log(`Validating Azure Pipeline references in: ${absoluteRootDir}`);
  }

  if (options.outputPath) {
    console.log(`Summary will be saved to ${options.outputPath}`);
  }

  console.log(`Node.js version: ${process.version}`);
  console.log(`Working directory: ${process.cwd()}`);
}

/**
 * Logs repository information in verbose mode
 *
 * @param options - Options object
 * @param repoConfigs - Repository configurations
 */
function logRepoInfo(
  options: { verbose: boolean },
  repoConfigs: RepoConfig[]
): void {
  if (!options.verbose) return;

  console.log(`Validating ${repoConfigs.length} repositories:`);
  repoConfigs.forEach((repo) => {
    console.log(`- ${repo.name}: ${repo.path}`);
  });

  console.log(`Node.js version: ${process.version}`);
  console.log(`Working directory: ${process.cwd()}`);
}

/**
 * Saves validation result to file
 *
 * @param outputPath - Output file path
 * @param content - Content to save
 */
function saveOutputToFile(outputPath: string, content: string): void {
  fs.writeFileSync(outputPath, content);
  console.log(`Summary saved to ${outputPath}`);
}

/**
 * Get repository configurations based on command line options
 *
 * @param options - Command line options
 * @returns Repository configurations
 */
function getRepositoryConfigs(options: {
  configPath?: string;
  autoDetect: boolean;
  basePath: string;
}): RepoConfig[] {
  const { configPath, autoDetect, basePath } = options;

  if (autoDetect) {
    return autoDetectRepositories(basePath);
  }

  if (configPath) {
    return loadRepoConfig(configPath);
  }

  throw new ConfigurationError(
    "No repository configuration or auto-detection specified"
  );
}

/**
 * Runs validation in single repository mode
 */
async function runSingleRepoValidation(options: {
  rootDir: string;
  outputPath?: string;
  verbose: boolean;
}): Promise<number> {
  const { rootDir, outputPath, verbose } = options;

  try {
    // Validate directory exists and get absolute path
    const absoluteRootDir = validateDirectory(rootDir);

    // Log information in verbose mode
    logVerboseInfo(options, absoluteRootDir);

    // Run validation
    const result = validatePipelines(absoluteRootDir);

    // Save summary to file if output path is specified
    if (outputPath) {
      const formatter = FormatterFactory.createMarkdownFormatter({ verbose });
      const summaryText = formatter.format(result);
      saveOutputToFile(outputPath, summaryText);
    }

    // Print result to console
    const formatter = FormatterFactory.createConsoleFormatter({ verbose });
    console.log(formatter.format(result));

    return result.isValid ? 0 : 1;
  } catch (error) {
    return handleError<number>(error, 1, (err: Error) => {
      console.error("Error validating pipeline references:", err.message);
    });
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
}): Promise<number> {
  const { configPath, autoDetect, basePath, outputPath, verbose } = options;
  let repoConfigs: RepoConfig[] = [];

  try {
    // Get repository configurations
    repoConfigs = getRepositoryConfigs({ configPath, autoDetect, basePath });

    // Save detected repos to a config file if output path is specified
    if (autoDetect && outputPath && repoConfigs.length > 0) {
      const detectedConfigPath = path.join(
        path.dirname(outputPath),
        "detected-repos.json"
      );

      saveOutputToFile(
        detectedConfigPath,
        JSON.stringify({ repositories: repoConfigs }, null, 2)
      );
    }
  } catch (error) {
    return handleError<number>(error, 1, (err: Error) => {
      if (err instanceof ConfigurationError) {
        console.error("Configuration error:", err.message);
      } else {
        console.error("Error preparing for validation:", err.message);
      }

      if (!configPath && !autoDetect) {
        program.help();
      }
    });
  }

  if (repoConfigs.length === 0) {
    console.error("No repositories found or configured.");
    return 1;
  }

  // Log repository information in verbose mode
  logRepoInfo({ verbose }, repoConfigs);

  try {
    // Run validation
    const result = validatePipelines(repoConfigs);

    // Save summary to file if output path is specified
    if (outputPath) {
      const formatter = FormatterFactory.createMarkdownFormatter({ verbose });
      const summaryText = formatter.format(result, repoConfigs);
      saveOutputToFile(outputPath, summaryText);
    }

    // Print result to console
    const formatter = FormatterFactory.createConsoleFormatter({ verbose });
    console.log(formatter.format(result, repoConfigs));

    return result.isValid ? 0 : 1;
  } catch (error) {
    return handleError<number>(error, 1, (err: Error) => {
      console.error("Error validating pipeline references:", err.message);
    });
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
    .option(
      "-w, --watch",
      "Watch mode: continuously monitor for changes and re-validate",
      false
    )
    .action(async (pathArg, options): Promise<void> => {
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

      // Check if we're in watch mode
      if (options.watch) {
        try {
          console.log("Starting watch mode...");

          let repoConfigs: RepoConfig[] | string;
          let formatter: ConsoleFormatter;

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

            // Get repository configurations
            repoConfigs = getRepositoryConfigs({
              configPath: configPath ? path.resolve(configPath) : undefined,
              autoDetect: options.autoDetect,
              basePath: autoDetectBasePath,
            });

            formatter = FormatterFactory.createConsoleFormatter({
              verbose: options.verbose,
            });

            // Start watching
            watchRepositories(repoConfigs, {
              verbose: options.verbose,
              onValidation: (result, repos) => {
                console.log(formatter.format(result, repos));
              },
            });
          } else {
            // Single repository mode
            const rootDir = path.resolve(pathArg);
            // Validate directory exists
            repoConfigs = validateDirectory(rootDir);

            formatter = FormatterFactory.createConsoleFormatter({
              verbose: options.verbose,
            });

            // Start watching
            watchRepositories(repoConfigs, {
              verbose: options.verbose,
              onValidation: (result) => {
                console.log(formatter.format(result));
              },
            });
          }

          // Keep the process alive
          process.stdin.resume();
          console.log("Press Ctrl+C to exit");

          return;
        } catch (error) {
          handleError<number>(error, 1, (err: Error) => {
            console.error("Error starting watch mode:", err.message);
          });
          process.exit(1);
        }
      }

      // Regular non-watch mode execution
      let exitCode: number;

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

      // Process exit is handled in the main function
      process.exit(exitCode);
    });

  return program;
}

/**
 * Main entry point
 */
async function main() {
  const program = setupCommands();
  await program.parseAsync(process.argv);

  // Note: Process exit is handled within the action handler
  // Watch mode will keep the process alive via stdin.resume()
}

// Only run the main function when this module is executed directly (not imported in tests)
// For ESM modules, use import.meta.url to check if this is the main module
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

// Export for testing
export { setupCommands, autoDetectRepositories, loadRepoConfig };

// Re-export formatters for testing
export { FormatterFactory };
