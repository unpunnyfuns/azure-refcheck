# Azure Reference Checker (azrefcheck)

A tool to validate all template imports and extensions in Azure Pipelines within and across repositories.

[![npm version](https://img.shields.io/npm/v/@unpunnyfuns/azure-refcheck.svg)](https://www.npmjs.com/package/@unpunnyfuns/azure-refcheck)
[![GitHub repo](https://img.shields.io/badge/GitHub-azure--refcheck-blue)](https://github.com/unpunnyfuns/azure-refcheck)

## Overview

This tool analyzes Azure Pipeline YAML files to validate references between them. It works with both single repositories and across multiple repositories. All repositories must be cloned locally - the tool doesn't directly access remote Git repositories.

It can detect:

- Broken template references within a repository
- Cross-repository template references
- Version-specific references (tags, branches, commits)
- Repository aliases and versions

## Installation

Requirements:
- Node.js 14.x or higher
- npm 7.x or higher

```bash
# Local installation
npm install @unpunnyfuns/azure-refcheck

# Global installation
npm install -g @unpunnyfuns/azure-refcheck
```

After installation, the `azrefcheck` command will be available in your path.

## Usage

### Examples

```bash
# Validate a single repository
azrefcheck ./path/to/repo -v

# Use a configuration file
azrefcheck ./path/to/config.json -v

# Auto-detect repositories
azrefcheck -a -b ./path/to/parent/dir -v

# Save results to file
azrefcheck ./path/to/repo -o results.md

# Watch mode
azrefcheck ./path/to/repo -w
```

### Command Line Options

```
Options:
  -v, --verbose              Show verbose output with additional context (default: false)
  -o, --output <file>        Output file for results (default: stdout)
  -c, --config <file>        Configuration file (for multiple repositories)
  -a, --auto-detect          Auto-detect repositories (used with --base-path)
  -b, --base-path <dir>      Base directory for repository auto-detection
  -w, --watch                Watch mode: continuously monitor for changes and re-validate
  -h, --help                 Display help
  --version                  Display version
```

### Watch Mode

```bash
# Watch for changes and re-validate
azrefcheck ./path/to/repo -w

# Watch with a config file
azrefcheck -c ./config.json -w
```

### Configuration File

```json
{
  "repositories": [
    {
      "name": "main-repo", 
      "path": "/path/to/main-repo"
    },
    {
      "name": "template-repo",
      "path": "./template-repo",
      "aliases": ["templates", "common-templates"],
      "url": "https://github.com/organization/template-repo.git",
      "ref": "main",
      "skipValidation": true
    }
  ]
}
```

Configuration properties:

| Property        | Required | Description |
|-----------------|----------|-------------|
| `name`          | Yes      | Repository name used in pipeline references |
| `path`          | Yes      | Path to the repository (absolute or relative to config file) |
| `aliases`       | No       | Alternative names for the repository |
| `url`           | No       | Git URL for version validation |
| `ref`           | No       | Git reference to use for validation (branch, tag, or commit SHA). Overrides any references in pipeline files. |
| `skipValidation`| No       | When true, skips validation for this repository |

### Supported Reference Types

```yaml
# Local references with template syntax
template: templates/build.yml
- template: templates/build.yml

# Local references with extends syntax
extends: templates/build.yml

# Cross-repository references
template: templates/build.yml@template-repo
extends: templates/build.yml@template-repo
```

Version-specific references are defined in repository resources and are validated when checking references:

```yaml
resources:
  repositories:
    - repository: template-repo
      type: git
      name: ProjectName/RepoName
      ref: refs/heads/main  # Branch reference
```

Note: The `ref` property in config.json overrides any references defined in pipeline files.

## Validation Approach

The tool performs these validations:

- Validates that referenced template files exist at the specified path
- Checks cross-repository references against repository configurations
- Verifies that repositories exist with the specified names or aliases
- Validates Git references (branches, tags, commits) when specified

The command returns exit code `0` when all references are valid and `1` when one or more references are invalid or an error occurred.

## Development

### Building

```bash
npm run build
```

### Testing

Run the test suite (watch mode for development):

```bash
npm test
```

Run tests once (CI/CD mode):

```bash
npm run test:run
```

Run pipeline validation tests with test fixtures:

```bash
npm run validate
```

Run all quality checks (linting, testing, building):

```bash
npm run quality
```

### External Test Fixtures

For thorough testing, especially for version validation scenarios, we use external test fixtures. These provide realistic Git repositories with proper history, branches, and tags.

See [Test Fixtures README](./test-fixtures/README.md) for more details on how fixtures are structured and can be used.


## Troubleshooting

Common issues and solutions:

| Issue | Solution |
| ----- | -------- |
| "No repositories found" | Verify paths in config file or use `--verbose` flag to see which paths are being checked |
| "Repository not found" | Check that aliases are correctly configured or use `--verbose` to debug repository detection |
| Version validation fails | Ensure the repository has the specified branch/tag/commit and the `url` is correctly set |
| Performance issues with many files | Files are cached after first scan; for very large repositories use specific paths |

## Issues and Contributions

Issues and feature requests can be submitted on our [GitHub repo](https://github.com/unpunnyfuns/azure-refcheck/issues).

Pull requests are welcome! Please read our [contributing guidelines](https://github.com/unpunnyfuns/azure-refcheck/blob/main/CONTRIBUTING.md) first.

## License

MIT