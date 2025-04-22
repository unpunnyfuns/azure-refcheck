# Azure Reference Checker (azrefcheck)

A tool to validate all template imports and extensions in Azure Pipelines across multiple repositories.

## Overview

This tool analyzes Azure Pipeline YAML files to validate references between them. It can detect:

- Broken template references within a repository
- Cross-repository template references
- Version-specific references (tags, branches, commits)
- Repository aliases and versions
- Dependency graphs for visualization of template relationships

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

Run the test suite:

```bash
npm test
```

Run pipeline validation tests:

```bash
npm run validate
```

### External Test Fixtures

For thorough testing, especially for version validation scenarios, we use external test fixtures. These provide realistic Git repositories with proper history, branches, and tags.

See [External Fixtures Documentation](./test-fixtures/EXTERNAL_FIXTURES.md) for setup instructions.


## License

UNLICENSED