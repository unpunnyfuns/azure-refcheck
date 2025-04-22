#!/bin/bash
# Setup script for the single repository fixture

# Source common functions
source "$(dirname "$(dirname "${BASH_SOURCE[0]}")")/common.sh"

# Set up a single-repo fixture
setup_single_repo() {
  echo -e "${YELLOW}Setting up single-repo fixture...${NC}"
  
  # Create the fixture directory
  local target_dir="$FIXTURES_GENERATED_DIR/single-repo"
  mkdir -p "$target_dir"
  
  # Copy files from templates
  copy_template_files "single-repo" "$target_dir"
  
  # Initialize Git repo
  init_git_repo "$target_dir"
  
  echo -e "${GREEN}Single-repo fixture created at: $target_dir${NC}"
}

# Set up a broken single-repo fixture
setup_broken_single_repo() {
  echo -e "${YELLOW}Setting up broken single-repo fixture...${NC}"
  
  # Create the fixture directory
  local target_dir="$FIXTURES_GENERATED_DIR/broken-single-repo"
  mkdir -p "$target_dir"
  
  # Copy files from templates directly (no need to create working fixture first)
  copy_template_files "broken-single-repo" "$target_dir"
  
  # Initialize Git repo
  init_git_repo "$target_dir"
  
  echo -e "${GREEN}Broken single-repo fixture created at: $target_dir${NC}"
}