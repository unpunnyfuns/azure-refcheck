# Azure Reference Checker (azrefcheck)

A tool to validate all template imports and extensions in Azure Pipelines across multiple repositories.

[![npm version](https://img.shields.io/npm/v/@unpunnyfuns/azure-refcheck.svg)](https://www.npmjs.com/package/@unpunnyfuns/azure-refcheck)
[![GitHub repo](https://img.shields.io/badge/GitHub-azure--refcheck-blue)](https://github.com/unpunnyfuns/azure-refcheck)

## Overview

This tool analyzes Azure Pipeline YAML files to validate references between them. It can detect:

- Broken template references within a repository
- Cross-repository template references
- Version-specific references (tags, branches, commits)
- Repository aliases and versions

## Installation

```bash
# Local installation
npm install @unpunnyfuns/azure-refcheck

# Global installation
npm install -g @unpunnyfuns/azure-refcheck
```

After installation, the `azrefcheck` command will be available in your path.

## Usage

### Command Line Interface

```bash
# Validate a single repository
azrefcheck ./path/to/repo -v

# Validate multiple repositories with a configuration file
azrefcheck ./path/to/config.json -v

# Auto-detect repositories in a directory
azrefcheck -a -b ./path/to/parent/dir -v

# Save validation results to a file
azrefcheck ./path/to/repo -o validation-results.md
```

### Command Line Options

```
Options:
  -v, --verbose            Show verbose output with additional context (default: false)
  -o, --output <file>      Output file for results (default: stdout)
  -c, --config <file>      Configuration file (for multiple repositories)
  -a, --auto-detect        Auto-detect repositories (used with --base-dir)
  -b, --base-dir <dir>     Base directory for repository auto-detection
  -h, --help               Display help
  --version                Display version
```

### Configuration File

For multiple repositories, create a configuration file:

```json
{
  "repositories": [
    {
      "name": "main-repo",
      "path": "/path/to/main-repo",
      "aliases": ["self"]
    },
    {
      "name": "template-repo",
      "path": "/path/to/template-repo",
      "aliases": ["templates"]
    }
  ]
}
```

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


## Issues and Contributions

Issues and feature requests can be submitted on our [GitHub repo](https://github.com/unpunnyfuns/azure-refcheck/issues).

Pull requests are welcome! Please read our [contributing guidelines](https://github.com/unpunnyfuns/azure-refcheck/blob/main/CONTRIBUTING.md) first.

## License

MIT