#!/bin/bash
# Setup script for the multi-repository fixtures

# Source common functions
source "$(dirname "$(dirname "${BASH_SOURCE[0]}")")/common.sh"

# Set up a multi-repo fixture
setup_multi_repo() {
  echo -e "${YELLOW}Setting up multi-repo fixture...${NC}"
  
  # Create the fixture directory
  local target_dir="$FIXTURES_GENERATED_DIR/multi-repo"
  mkdir -p "$target_dir"
  
  # Copy files from templates
  copy_template_files "multi-repo" "$target_dir"
  
  # Initialize each repo
  init_git_repo "$target_dir/main-repo"
  init_git_repo "$target_dir/template-repo"
  init_git_repo "$target_dir/infra-repo"
  
  # Update config.json with absolute paths if needed
  update_config_paths "$target_dir/config.json" "$target_dir" "$1"
  
  echo -e "${GREEN}Multi-repo fixture created at: $target_dir${NC}"
}

# Set up a broken multi-repo fixture
setup_broken_multi_repo() {
  echo -e "${YELLOW}Setting up broken multi-repo fixture...${NC}"
  
  # Create the fixture directory
  local target_dir="$FIXTURES_GENERATED_DIR/broken-multi-repo"
  mkdir -p "$target_dir"
  
  # Copy files from templates directly
  copy_template_files "broken-multi-repo" "$target_dir"
  
  # Initialize each repo
  init_git_repo "$target_dir/main-repo"
  init_git_repo "$target_dir/template-repo"
  init_git_repo "$target_dir/infra-repo"
  
  # Update config.json with absolute paths if needed
  update_config_paths "$target_dir/config.json" "$target_dir" "$1"
  
  echo -e "${GREEN}Broken multi-repo fixture created at: $target_dir${NC}"
}