#!/bin/bash
# Template validation checking script - runs everything with a single command

set -eo pipefail  # Exit on error, including in pipes

# Define colors for better output
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
BLUE="\033[0;36m"
BOLD="\033[1m"
NC="\033[0m" # No Color

# Process command line arguments
VERBOSE=false
CLEANUP=true
HELP=false

for arg in "$@"; do
  case $arg in
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --no-cleanup)
      CLEANUP=false
      shift
      ;;
    --help|-h)
      HELP=true
      shift
      ;;
  esac
done

# Show help if requested
if [ "$HELP" = true ]; then
  echo -e "${BOLD}${BLUE}Azure Pipeline Template Validation Check${NC}"
  echo -e "========================================"
  echo -e "Run a complete validation check with a single command."
  echo ""
  echo -e "${YELLOW}Usage:${NC} npm run validate [-- [options]]"
  echo ""
  echo -e "${YELLOW}Options:${NC}"
  echo "  --help, -h      Show this help message"
  echo "  --verbose, -v   Show detailed output from each step"
  echo "  --no-cleanup    Keep generated fixtures after testing (for debugging)"
  echo ""
  echo -e "${YELLOW}What this script does:${NC}"
  echo "  1. Builds the validation tool"
  echo "  2. Sets up test fixtures for different pipeline scenarios"
  echo "  3. Runs validation against each fixture to test the tool"
  echo "  4. Cleans up automatically (unless --no-cleanup is specified)"
  echo "  5. Provides a simple pass/fail result"
  echo ""
  exit 0
fi

echo -e "${BOLD}${BLUE}Running Azure Pipeline Template Validation Check${NC}"
echo -e "This builds the tool, generates fixtures, and validates template references."

start_time=$(date +%s)

# Create a log file for output
LOG_FILE=$(mktemp)

# Step 1: Build
echo -e "\n${BOLD}${YELLOW}Step 1:${NC} Building validation tool..."
if [ "$VERBOSE" = true ]; then
  npm run build
else
  echo "Running build..." 
  npm run build > "$LOG_FILE" 2>&1 || { 
    echo -e "${RED}Build failed. Output:${NC}"; 
    cat "$LOG_FILE"; 
    rm -f "$LOG_FILE"; 
    exit 1; 
  }
fi

# Step 2: Set up fixtures and run validation tests
echo -e "\n${BOLD}${YELLOW}Step 2:${NC} Setting up fixtures and running validation tests..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Clean up existing fixtures first
rm -rf "$SCRIPT_DIR/fixtures"

# Set up fixtures - do not redirect to log file in verbose mode
echo "Setting up fixtures..."
if [ "$VERBOSE" = true ]; then
  "$SCRIPT_DIR/scripts/setup-fixtures.sh"
else
  "$SCRIPT_DIR/scripts/setup-fixtures.sh" > "$LOG_FILE" 2>&1 || {
    echo -e "${RED}Fixture setup failed. Output:${NC}"
    cat "$LOG_FILE"
    rm -f "$LOG_FILE"
    exit 1
  }
fi

# Setup succeeded if we got this far

# Fixture types to test
FIXTURES=(
  "single-repo" 
  "multi-repo/config.json" 
  "versioned-repo/config.json"
)
BROKEN_FIXTURES=(
  "broken-single-repo" 
  "broken-multi-repo/config.json" 
  "broken-versioned-repo/config.json"
)

# Run validation tests
echo "Running validation tests..."
ALL_WORKING_PASS=true
ALL_BROKEN_FAIL=true
RESULT=0

if [ "$VERBOSE" = true ]; then
  # In verbose mode, show output directly but without stopping on errors
  echo -e "\n${BLUE}=== Working Fixtures Tests ===${NC}"
  
  # Test all working fixtures (all should pass)
  for fixture in "${FIXTURES[@]}"; do
    echo -e "\n${YELLOW}Testing: $fixture${NC}"
    set +e
    node dist/cli.js "$SCRIPT_DIR/fixtures/$fixture" -v
    if [ $? -ne 0 ]; then
      echo -e "${RED}❌ Working fixture failed validation!${NC}"
      ALL_WORKING_PASS=false
    fi
    set -eo pipefail
  done
  
  echo -e "\n${BLUE}=== Broken Fixtures Tests ===${NC}"
  
  # Test all broken fixtures (all should fail)
  for fixture in "${BROKEN_FIXTURES[@]}"; do
    echo -e "\n${YELLOW}Testing: $fixture${NC}"
    set +e
    node dist/cli.js "$SCRIPT_DIR/fixtures/$fixture" -v
    BROKEN_RESULT=$?
    set -eo pipefail
    
    if [ $BROKEN_RESULT -eq 0 ]; then
      echo -e "${RED}❌ Broken fixture incorrectly passed validation!${NC}"
      ALL_BROKEN_FAIL=false
    else
      echo -e "${GREEN}✅ Broken fixture correctly failed validation${NC}"
    fi
  done
  
  # Set the final result - validation test passes only if working fixtures pass AND broken fixtures fail
  if [ "$ALL_WORKING_PASS" = false ] || [ "$ALL_BROKEN_FAIL" = false ]; then
    RESULT=1
    echo -e "\n${RED}❌ Some tests did not behave as expected. See details above.${NC}"
  else 
    echo -e "\n${GREEN}✅ All fixtures validated correctly. Working fixtures passed, broken fixtures failed.${NC}"
  fi
  
else
  # In silent mode, test each working fixture
  for fixture in "${FIXTURES[@]}"; do
    node dist/cli.js "$SCRIPT_DIR/fixtures/$fixture" -v > "$LOG_FILE" 2>&1
    if [ $? -ne 0 ]; then
      echo -e "${RED}Validation failed on working fixture: $fixture${NC}"
      cat "$LOG_FILE"
      RESULT=1
      break
    fi
  done
  
  # Only test broken fixtures if working ones passed
  if [ $RESULT -eq 0 ]; then
    for fixture in "${BROKEN_FIXTURES[@]}"; do
      set +e
      node dist/cli.js "$SCRIPT_DIR/fixtures/$fixture" -v > "$LOG_FILE" 2>&1
      BROKEN_RESULT=$?
      set -eo pipefail
      
      if [ $BROKEN_RESULT -eq 0 ]; then
        echo -e "${RED}ERROR: Validation incorrectly passed on broken fixture: $fixture${NC}"
        RESULT=1
        break
      fi
    done
  fi
fi

# Clean up if not keeping fixtures
if [ "$CLEANUP" = true ]; then
  echo "Cleaning up fixtures..."
  rm -rf "$SCRIPT_DIR/fixtures" > /dev/null 2>&1
fi

# Show output if there was an error and we're not in verbose mode
if [ $RESULT -ne 0 ] && [ "$VERBOSE" = false ]; then
  echo -e "${RED}Tests failed. Output:${NC}"
  cat "$LOG_FILE"
fi

# Clean up log file
rm -f "$LOG_FILE"

end_time=$(date +%s)
duration=$((end_time - start_time))

# Show result
echo -e "\n${BOLD}${BLUE}Validation Check Complete${NC}"
echo -e "Total time: ${duration} seconds"

# Show test summary
echo -e "\n${BOLD}${YELLOW}Results:${NC}"
if [ $RESULT -eq 0 ]; then
  echo -e "${BOLD}${GREEN}✅ PASSED:${NC} All validation checks completed successfully!"
  echo -e "Validation tool correctly identified valid and invalid templates."
  if [ "$VERBOSE" = false ]; then
    echo -e "Run with ${BOLD}--verbose${NC} to see detailed test results."
  fi
  exit 0
else
  echo -e "${BOLD}${RED}❌ FAILED:${NC} Some validation checks failed."
  echo -e "${YELLOW}Options for troubleshooting:${NC}"
  if [ "$VERBOSE" = false ]; then
    echo -e "  * Run with ${BOLD}--verbose${NC} to see detailed output"
  fi
  if [ "$CLEANUP" = true ]; then
    echo -e "  * Add ${BOLD}--no-cleanup${NC} to keep fixtures for examination"
  else
    echo -e "  * Fixtures are available in ${BOLD}test-fixtures/fixtures/${NC} for inspection"
  fi
  exit 1
fi