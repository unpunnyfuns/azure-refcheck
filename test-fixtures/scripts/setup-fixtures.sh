#!/bin/bash
# Main script to set up test fixtures from templates

set -eo pipefail  # Exit on error, including in pipes


# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Source fixture type scripts
source "$SCRIPT_DIR/fixtures/single-repo.sh"
source "$SCRIPT_DIR/fixtures/multi-repo.sh"
source "$SCRIPT_DIR/fixtures/versioned-repo.sh"

# Display help message
show_help() {
  echo -e "${GREEN}Pipeline Validation Test Fixtures${NC}"
  echo -e "================================="
  echo -e "This script creates test fixtures for validating Azure Pipeline template references."
  echo ""
  echo -e "${YELLOW}Usage:${NC} $0 [options] [fixture_types]"
  echo ""
  echo -e "${YELLOW}Options:${NC}"
  echo "  --help           Show this help message"
  echo "  --clean          Clean up existing fixtures before setup"
  echo "  --absolute       Use absolute paths in config files (for debugging)"
  echo ""
  echo -e "${YELLOW}Fixture Types:${NC} (if none specified, all are set up)"
  echo ""
  echo -e "${GREEN}Working Fixtures:${NC}"
  echo "  --single         Set up single-repo fixture (simple repository)"
  echo "  --multi          Set up multi-repo fixture (cross-repository references)"
  echo "  --versioned      Set up versioned-repo fixture (Git tags and versions)"
  echo ""
  echo -e "${RED}Broken Fixtures:${NC} (contain intentionally invalid references)"
  echo "  --broken-single  Set up broken single-repo fixture"
  echo "  --broken-multi   Set up broken multi-repo fixture"
  echo "  --broken-versioned  Set up broken versioned-repo fixture"
  echo ""
  echo -e "${YELLOW}Examples:${NC}"
  echo "  $0                       # Setup all fixtures"
  echo "  $0 --clean               # Clean and setup all fixtures"
  echo "  $0 --single --multi      # Setup only single and multi repo fixtures"
  echo "  $0 --broken-versioned    # Setup only the broken versioned repo fixture"
  echo ""
  echo -e "${YELLOW}Note:${NC} Fixtures are created in the ${FIXTURES_GENERATED_DIR} directory"
}

# Main function
main() {
  local absolute_paths=""
  local setup_all=true
  local setup_single=false
  local setup_multi=false
  local setup_versioned=false
  local setup_broken_single=false
  local setup_broken_multi=false
  local setup_broken_versioned=false
  
  # Process command line arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --help)
        show_help
        exit 0
        ;;
      --clean)
        cleanup_fixtures
        ;;
      --absolute)
        absolute_paths="--absolute"
        ;;
      --single)
        setup_all=false
        setup_single=true
        ;;
      --multi)
        setup_all=false
        setup_multi=true
        ;;
      --versioned)
        setup_all=false
        setup_versioned=true
        ;;
      --broken-single)
        setup_all=false
        setup_broken_single=true
        ;;
      --broken-multi)
        setup_all=false
        setup_broken_multi=true
        ;;
      --broken-versioned)
        setup_all=false
        setup_broken_versioned=true
        ;;
      *)
        echo "Unknown option: $1"
        echo "Run '$0 --help' for usage information"
        exit 1
        ;;
    esac
    shift
  done
  
  # Create basic directory structure
  setup_directories
  
  # Set up selected fixtures - each fixture is now independent
  
  # Working fixtures
  if [[ "$setup_all" == true ]] || [[ "$setup_single" == true ]]; then
    setup_single_repo
  fi
  
  if [[ "$setup_all" == true ]] || [[ "$setup_multi" == true ]]; then
    setup_multi_repo "$absolute_paths"
  fi
  
  if [[ "$setup_all" == true ]] || [[ "$setup_versioned" == true ]]; then
    setup_versioned_repo "$absolute_paths"
  fi
  
  # Broken fixtures (now independent of working fixtures)
  if [[ "$setup_all" == true ]] || [[ "$setup_broken_single" == true ]]; then
    setup_broken_single_repo
  fi
  
  if [[ "$setup_all" == true ]] || [[ "$setup_broken_multi" == true ]]; then
    setup_broken_multi_repo "$absolute_paths"
  fi
  
  if [[ "$setup_all" == true ]] || [[ "$setup_broken_versioned" == true ]]; then
    setup_broken_versioned_repo "$absolute_paths"
  fi
  
  echo -e "${GREEN}All requested fixtures have been set up successfully!${NC}"
}

# Run the main function with provided arguments
main "$@"