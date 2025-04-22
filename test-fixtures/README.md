# Test Fixtures for Pipeline Validation

This directory contains test fixtures for validating the pipeline validation tool.

## Directory Structure

- `/test-fixtures/` - Root directory for all test fixtures
  - `/templates/` - Templates for generating test fixtures
    - `/pipelines/` - Pipeline YAML files (both working and broken versions)
    - `/templates/` - Template YAML files organized by type
    - `/config/` - Configuration files for multi-repo and versioned-repo fixtures
  - `/scripts/` - Scripts for setting up and managing test fixtures
  - `/fixtures/` - Directory where generated test fixtures are created (gitignored)

## Types of Fixtures

All fixtures are generated dynamically from templates during test runs. This approach ensures consistency and allows for easier updates.

### Success Case Fixtures

These fixtures are generated with all valid references to test successful validation:

- `fixtures/single-repo`: A simple repository with all valid references
- `fixtures/multi-repo`: Multiple repositories with all valid cross-repo references
- `fixtures/versioned-repo`: Repositories with Git tags and version-specific references

### Failure Case Fixtures

These fixtures include intentionally broken references to test validation error detection:

- `fixtures/broken-single-repo`: A simple repository with a broken reference
- `fixtures/broken-multi-repo`: Multiple repositories with a broken cross-repo reference
- `fixtures/broken-versioned-repo`: Repositories with incorrect version references and missing templates

## Scripts

The test fixtures use a modular script structure:

- `scripts/setup-fixtures.sh`: Main script to create dynamic test fixtures from templates
  - Usage: `./scripts/setup-fixtures.sh [options] [fixture_types]`
  - Options:
    - `--help`: Show help message
    - `--clean`: Clean up existing dynamic fixtures
    - `--absolute`: Use absolute paths in config files (for debugging)
  - Fixture types:
    - `--single`: Set up single-repo fixture only
    - `--multi`: Set up multi-repo fixture only  
    - `--versioned`: Set up versioned-repo fixture only
    - `--broken-single`: Set up broken single-repo fixture only
    - `--broken-multi`: Set up broken multi-repo fixture only
    - `--broken-versioned`: Set up broken versioned-repo fixture only

- `scripts/common.sh`: Common utilities used by all fixture scripts
- `scripts/fixtures/*.sh`: Individual fixture type setup scripts

## Running Tests

The simplest way to run validation tests is with the provided NPM script:

```bash
# Run complete validation (setup fixtures, run tests, cleanup)
npm run validate

# Show help with all options
npm run validate -- --help

# Run with verbose output
npm run validate -- --verbose

# Run without cleanup (for debugging)
npm run validate -- --no-cleanup

# Generate a dependency graph (in text format)
npm run validate -- --graph

# Generate a dependency graph in DOT format (for Graphviz)
npm run validate -- --graph dot --graph-output graph.dot
```

You can also set up fixtures directly without running tests:

```bash
# Set up test fixtures
./test-fixtures/scripts/setup-fixtures.sh

# Show all setup options
./test-fixtures/scripts/setup-fixtures.sh --help
```

## Adding New Fixtures

To add a new test fixture:

1. Add template files to the appropriate subdirectory in `/test-fixtures/templates/`
2. Update `copy_template_files()` function in `scripts/common.sh` to include your new fixture
3. Create a setup script in `scripts/fixtures/` if needed
4. Update `scripts/setup-fixtures.sh` to include your new fixture
5. Update `run-validation-check.sh` to test your new fixture

## Cleaning Up

Dynamic fixtures are automatically cleaned up after running tests, but you can manually clean them:

```bash
./test-fixtures/scripts/setup-fixtures.sh --clean
```

## Implementation Details

- All fixtures are created from templates at test time
- Each fixture is self-contained and doesn't depend on other fixtures
- Template files are organized by purpose rather than by fixture type
- Working and broken versions of the same files are kept together with clear naming:
  - `working-cd-pipeline.yml` vs `broken-cd-pipeline.yml`
  - `working-main-pipeline.yml` vs `broken-main-pipeline.yml` 
- Git repositories are initialized in each fixture for proper validation
- Versioned fixture includes Git tags for testing version-specific validation
- All fixtures are automatically cleaned up when tests finish unless `--no-cleanup` is specified

This approach makes it easier to:
- See the differences between working and broken versions
- Add new fixture types
- Understand what makes a fixture broken
- Track changes to template files in version control