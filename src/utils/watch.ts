import path from "node:path";
import chokidar from "chokidar";
import type { RepoConfig } from "#config";
import { findPipelineFiles } from "#utils/file";
import { getFileSystem } from "#utils/filesystem";
import { type ValidationResult, validatePipelines } from "#validator";

/**
 * Options for watch mode
 */
export interface WatchOptions {
  /** Use verbose logging */
  verbose: boolean;
  /** Callback function to execute on each validation run */
  onValidation?: (result: ValidationResult, repoConfigs?: RepoConfig[]) => void;
}

/**
 * Watch repositories for changes and run validation
 *
 * @param repos - Repository configuration or path
 * @param options - Watch options
 * @returns A function to stop watching
 */
export function watchRepositories(
  repos: string | RepoConfig[],
  options: WatchOptions
): () => void {
  const { verbose, onValidation } = options;

  // Get file paths to watch based on repo configs
  const repoPaths =
    typeof repos === "string" ? [repos] : repos.map((repo) => repo.path);

  const filesToWatch: string[] = [];

  // Find all pipeline files in the repositories
  repoPaths.forEach((repoPath) => {
    try {
      const pipelineFiles = findPipelineFiles(repoPath);
      filesToWatch.push(...pipelineFiles);
    } catch (error) {
      if (verbose) {
        console.error(`Error finding pipeline files in ${repoPath}:`, error);
      }
    }
  });

  if (verbose) {
    console.log(
      `Watching ${filesToWatch.length} pipeline files for changes...`
    );
    console.log("Press Ctrl+C to stop watching");
  }

  // Start watching files
  const watcher = chokidar.watch(filesToWatch, {
    persistent: true,
    ignoreInitial: true,
  });

  // Run initial validation
  runValidation();

  // When files change, re-run validation
  watcher.on("change", (changedPath) => {
    if (verbose) {
      console.log(`\nFile changed: ${path.basename(changedPath)}`);
    }

    // Clear console
    process.stdout.write("\x1Bc");

    // Clear file system cache to ensure fresh results
    const fileSystem = getFileSystem();
    if ("clearCache" in fileSystem) {
      fileSystem.clearCache();
    }

    runValidation();
  });

  /**
   * Run validation and call the onValidation callback
   */
  function runValidation() {
    try {
      // Display timestamp for validation run
      const timestamp = new Date().toLocaleTimeString();
      console.log(`\n[${timestamp}] Running validation...`);

      // Run validation
      const result = validatePipelines(repos);

      // Call the callback if provided
      if (onValidation) {
        if (typeof repos === "string") {
          onValidation(result);
        } else {
          onValidation(result, repos);
        }
      }
    } catch (error) {
      console.error("Error during validation:", error);
    }
  }

  // Return a function to stop watching
  return () => {
    watcher.close();
    if (verbose) {
      console.log("Stopped watching files");
    }
  };
}
