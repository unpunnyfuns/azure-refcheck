#!/bin/bash
# Setup script for the versioned repository fixtures

# Source common functions
source "$(dirname "$(dirname "${BASH_SOURCE[0]}")")/common.sh"

# Set up a versioned-repo fixture
setup_versioned_repo() {
  echo -e "${YELLOW}Setting up versioned-repo fixture...${NC}"
  
  # Create the fixture directory
  local target_dir="$FIXTURES_GENERATED_DIR/versioned-repo"
  mkdir -p "$target_dir"
  
  # Copy files from templates
  copy_template_files "versioned-repo" "$target_dir"
  
  # Initialize main-repo
  init_git_repo "$target_dir/main-repo"
  
  # Initialize template-repo with versioning 
  init_versioned_repo "$target_dir/template-repo"
  
  # Update config.json with absolute paths if needed
  update_config_paths "$target_dir/config.json" "$target_dir" "$1"
  
  echo -e "${GREEN}Versioned-repo fixture created at: $target_dir${NC}"
}

# Set up a broken versioned-repo fixture
setup_broken_versioned_repo() {
  echo -e "${YELLOW}Setting up broken versioned-repo fixture...${NC}"
  
  # Create the fixture directory
  local target_dir="$FIXTURES_GENERATED_DIR/broken-versioned-repo"
  mkdir -p "$target_dir"
  
  # Copy files from templates
  copy_template_files "broken-versioned-repo" "$target_dir"
  
  # Initialize main-repo
  init_git_repo "$target_dir/main-repo"
  
  # Initialize template-repo with versioning 
  init_versioned_repo "$target_dir/template-repo"
  
  # Update config.json with absolute paths if needed
  update_config_paths "$target_dir/config.json" "$target_dir" "$1"
  
  echo -e "${GREEN}Broken versioned-repo fixture created at: $target_dir${NC}"
}