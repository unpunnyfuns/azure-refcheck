#!/bin/bash

export GREEN="\033[0;32m"
export YELLOW="\033[0;33m"
export NC="\033[0m"

export SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export FIXTURES_DIR="$(dirname "$SCRIPT_DIR")"
export TEMPLATES_DIR="$FIXTURES_DIR/templates"
export FIXTURES_GENERATED_DIR="$FIXTURES_DIR/fixtures"

init_git_repo() {
  local repo_dir=$1
  pushd "$repo_dir" > /dev/null
  git init
  git config --local user.email "test@example.com"
  git config --local user.name "Test User"
  git add .
  git commit -m "Initial commit"
  popd > /dev/null
}

init_versioned_repo() {
  local repo_dir=$1
  
  pushd "$repo_dir" > /dev/null
  git init
  git config --local user.email "test@example.com"
  git config --local user.name "Test User"
  
  mkdir -p templates
  cp "$TEMPLATES_DIR/templates/versioned/build-template.yml" templates/
  cp "$TEMPLATES_DIR/templates/versioned/test-template.yml" templates/
  git add templates/build-template.yml templates/test-template.yml
  git commit -m "Initial commit - v1.0 templates"
  git tag "v1.0"
  
  cp "$TEMPLATES_DIR/templates/versioned/build-template-v2.yml" templates/
  git add templates/build-template-v2.yml
  git commit -m "Add v2.0 template with caching support"
  git tag "v2.0"
  
  popd > /dev/null
}

# Update config.json with absolute paths
update_config_paths() {
  local config_file=$1
  local target_dir=$2
  
  # Process all repository paths in the config
  if [[ "$3" == "--absolute" ]]; then
    # Read the file to find all "./something" patterns
    local repo_paths=$(grep -o '"\.\/[^"]*"' "$config_file" | sed 's/"//g')
    
    for repo_path in $repo_paths; do
      # Extract the relative path part (e.g., "./main-repo" -> "main-repo")
      local rel_path=$(echo "$repo_path" | sed 's/\.\///g')
      # Replace with absolute path
      sed -i '' "s|\"$repo_path\"|\"$target_dir/$rel_path\"|g" "$config_file"
    done
  fi
}

# Clean up existing generated fixtures
cleanup_fixtures() {
  echo -e "${YELLOW}Cleaning up existing fixtures...${NC}"
  
  # Remove previously generated fixtures
  rm -rf "$FIXTURES_GENERATED_DIR"
  
  echo -e "${GREEN}Cleanup complete.${NC}"
}

# Creates the basic directory structure for fixtures
setup_directories() {
  # Create fixtures directory for generated fixtures
  mkdir -p "$FIXTURES_GENERATED_DIR"
}

# Function to copy template files to a fixture directory
copy_template_files() {
  local fixture_type=$1  # e.g., "single-repo" or "broken-single-repo"
  local target_dir=$2    # destination directory
  
  # Create base directory structure
  mkdir -p "$target_dir"
  
  # Handle different fixture types
  case "$fixture_type" in
    single-repo)
      # Copy template files
      cp -r "$TEMPLATES_DIR/templates/common" "$target_dir/templates"
      
      # Copy pipeline files
      mkdir -p "$target_dir/pipelines"
      cp "$TEMPLATES_DIR/pipelines/working-cd-pipeline.yml" "$target_dir/pipelines/cd-pipeline.yml"
      cp "$TEMPLATES_DIR/pipelines/ci-pipeline.yml" "$target_dir/pipelines/"
      ;;
      
    broken-single-repo)
      # Copy template files (same as working)
      cp -r "$TEMPLATES_DIR/templates/common" "$target_dir/templates"
      
      # Copy pipeline files with broken version
      mkdir -p "$target_dir/pipelines"
      cp "$TEMPLATES_DIR/pipelines/broken-cd-pipeline.yml" "$target_dir/pipelines/cd-pipeline.yml"
      cp "$TEMPLATES_DIR/pipelines/ci-pipeline.yml" "$target_dir/pipelines/"
      ;;
      
    multi-repo)
      # Copy repos
      mkdir -p "$target_dir/template-repo/templates"
      mkdir -p "$target_dir/main-repo/pipelines"
      mkdir -p "$target_dir/infra-repo/templates"
      
      # Copy template repo files
      cp "$TEMPLATES_DIR/templates/multi/common-build.yml" "$target_dir/template-repo/templates/"
      cp "$TEMPLATES_DIR/templates/multi/common-test.yml" "$target_dir/template-repo/templates/"
      
      # Copy main repo files
      cp "$TEMPLATES_DIR/pipelines/working-main-pipeline.yml" "$target_dir/main-repo/pipelines/main-pipeline.yml"
      
      # Copy infra repo files
      cp "$TEMPLATES_DIR/templates/multi/azure-deploy.yml" "$target_dir/infra-repo/templates/"
      
      # Copy config
      cp "$TEMPLATES_DIR/config/working-multi-config.json" "$target_dir/config.json"
      ;;
      
    broken-multi-repo)
      # Copy repos
      mkdir -p "$target_dir/template-repo/templates"
      mkdir -p "$target_dir/main-repo/pipelines"
      mkdir -p "$target_dir/infra-repo/templates"
      
      # Copy template repo files (same as working)
      cp "$TEMPLATES_DIR/templates/multi/common-build.yml" "$target_dir/template-repo/templates/"
      cp "$TEMPLATES_DIR/templates/multi/common-test.yml" "$target_dir/template-repo/templates/"
      
      # Copy main repo files with broken version
      cp "$TEMPLATES_DIR/pipelines/broken-main-pipeline.yml" "$target_dir/main-repo/pipelines/main-pipeline.yml"
      
      # Copy infra repo files (same as working)
      cp "$TEMPLATES_DIR/templates/multi/azure-deploy.yml" "$target_dir/infra-repo/templates/"
      
      # Copy config
      cp "$TEMPLATES_DIR/config/broken-multi-config.json" "$target_dir/config.json"
      ;;
      
    versioned-repo)
      # Copy repos
      mkdir -p "$target_dir/template-repo/templates"
      mkdir -p "$target_dir/main-repo/pipelines"
      
      # Copy template repo files
      cp "$TEMPLATES_DIR/templates/versioned/build-template.yml" "$target_dir/template-repo/templates/"
      cp "$TEMPLATES_DIR/templates/versioned/build-template-v2.yml" "$target_dir/template-repo/templates/"
      cp "$TEMPLATES_DIR/templates/versioned/test-template.yml" "$target_dir/template-repo/templates/"
      
      # Copy main repo files
      cp "$TEMPLATES_DIR/pipelines/working-versioned-pipeline.yml" "$target_dir/main-repo/pipelines/main-pipeline.yml"
      
      # Copy config
      cp "$TEMPLATES_DIR/config/working-versioned-config.json" "$target_dir/config.json"
      ;;
      
    broken-versioned-repo)
      # Copy repos
      mkdir -p "$target_dir/template-repo/templates"
      mkdir -p "$target_dir/main-repo/pipelines"
      
      # Copy template repo files (same as working)
      cp "$TEMPLATES_DIR/templates/versioned/build-template.yml" "$target_dir/template-repo/templates/"
      cp "$TEMPLATES_DIR/templates/versioned/build-template-v2.yml" "$target_dir/template-repo/templates/"
      cp "$TEMPLATES_DIR/templates/versioned/test-template.yml" "$target_dir/template-repo/templates/"
      
      # Copy main repo files with broken version
      cp "$TEMPLATES_DIR/pipelines/broken-versioned-pipeline.yml" "$target_dir/main-repo/pipelines/main-pipeline.yml"
      
      # Copy config
      cp "$TEMPLATES_DIR/config/broken-versioned-config.json" "$target_dir/config.json"
      ;;
  esac
}