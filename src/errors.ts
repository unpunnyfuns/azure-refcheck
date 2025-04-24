/**
 * Base error class for the application
 */
export class AzureRefCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AzureRefCheckError";
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends AzureRefCheckError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/**
 * Error thrown when a repository is not found
 */
export class RepositoryNotFoundError extends AzureRefCheckError {
  constructor(repoName: string) {
    super(`Repository not found: ${repoName}`);
    this.name = "RepositoryNotFoundError";
  }
}

/**
 * Error thrown when a file is not found
 */
export class FileNotFoundError extends AzureRefCheckError {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`);
    this.name = "FileNotFoundError";
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends AzureRefCheckError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Error thrown when a directory is not found
 */
export class DirectoryNotFoundError extends AzureRefCheckError {
  constructor(dirPath: string) {
    super(`Directory not found: ${dirPath}`);
    this.name = "DirectoryNotFoundError";
  }
}

/**
 * Helper function to handle errors with graceful fallback
 *
 * @param error - Error object
 * @param fallback - Fallback value
 * @param errorHandler - Optional error handler
 * @returns Fallback value
 */
export function handleError<T>(
  error: unknown,
  fallback: T,
  errorHandler?: (err: Error) => void
): T {
  if (error instanceof Error) {
    if (errorHandler) {
      errorHandler(error);
    } else {
      console.error(`Error: ${error.message}`);
    }
  } else {
    console.error(`Unknown error: ${String(error)}`);
  }

  return fallback;
}
