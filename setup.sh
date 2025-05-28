#!/bin/bash

# KiCAD Viewer Nextcloud App Setup Script
# This script checks dependencies and builds the app

set -e

echo "=== KiCAD Viewer Setup Script ==="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check dependencies
check_dependencies() {
    echo "Checking dependencies from requirements.txt..."
    echo
    
    local missing_deps=()
    
    # Check each dependency
    if ! command_exists make; then
        echo -e "${RED}✗${NC} make - not found"
        missing_deps+=("make")
    else
        echo -e "${GREEN}✓${NC} make - found"
    fi
    
    if ! command_exists curl; then
        echo -e "${RED}✗${NC} curl - not found"
        missing_deps+=("curl")
    else
        echo -e "${GREEN}✓${NC} curl - found"
    fi
    
    if ! command_exists tar; then
        echo -e "${RED}✗${NC} tar - not found"
        missing_deps+=("tar")
    else
        echo -e "${GREEN}✓${NC} tar - found"
    fi
    
    if ! command_exists php; then
        echo -e "${RED}✗${NC} php - not found"
        missing_deps+=("php")
    else
        echo -e "${GREEN}✓${NC} php - found ($(php --version | head -n1))"
    fi
    
    if ! command_exists composer; then
        echo -e "${YELLOW}!${NC} composer - not found (will be downloaded automatically by make)"
    else
        echo -e "${GREEN}✓${NC} composer - found ($(composer --version | head -n1))"
    fi
    
    if ! command_exists node; then
        echo -e "${RED}✗${NC} node - not found"
        missing_deps+=("node")
    else
        echo -e "${GREEN}✓${NC} node - found ($(node --version))"
    fi
    
    if ! command_exists npm; then
        echo -e "${RED}✗${NC} npm - not found"
        missing_deps+=("npm")
    else
        echo -e "${GREEN}✓${NC} npm - found ($(npm --version))"
    fi
    
    # Note: whichcd appears to be a typo in the README, likely meant "which"
    if ! command_exists which; then
        echo -e "${RED}✗${NC} which - not found"
        missing_deps+=("which")
    else
        echo -e "${GREEN}✓${NC} which - found"
    fi
    
    echo
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo -e "${RED}Missing dependencies:${NC} ${missing_deps[*]}"
        echo
        echo "Please install the missing dependencies before continuing."
        echo "On Ubuntu/Debian: sudo apt-get install ${missing_deps[*]}"
        echo "On CentOS/RHEL: sudo yum install ${missing_deps[*]}"
        echo "On macOS: brew install ${missing_deps[*]}"
        echo
        read -p "Do you want to continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
        echo
    else
        echo -e "${GREEN}All dependencies are satisfied!${NC}"
        echo
    fi
}

# Function to setup Node.js dependencies
setup_node_deps() {
    echo "Setting up Node.js dependencies..."
    
    # Check if .nvmrc exists and suggest using nvm
    if [ -f ".nvmrc" ]; then
        echo "Found .nvmrc file. If you have nvm installed, run 'nvm use' to use the recommended Node.js version."
        echo
    fi
    
    # Install npm dependencies
    echo "Installing npm dependencies..."
    npm install
    echo -e "${GREEN}✓${NC} npm dependencies installed"
    echo
}

# Function to prepare build directories
prepare_build_dirs() {
    echo "Preparing build directories..."
    
    # Create icon directories if they don't exist
    # These are needed by the webpack build process
    mkdir -p src/img/icons-mime/dist
    mkdir -p src/img/icons-app/dist
    
    echo -e "${GREEN}✓${NC} Build directories prepared"
    echo
}

# Function to choose build type
choose_build_type() {
    echo "Choose build type:"
    echo "1) make      - Production build (optimized, minified)"
    echo "2) make dev  - Development build (unminified, faster)"
    echo
    
    while true; do
        read -p "Enter your choice (1 or 2): " choice
        case $choice in
            1)
                BUILD_CMD="make"
                BUILD_TYPE="production"
                break
                ;;
            2)
                BUILD_CMD="make dev"
                BUILD_TYPE="development"
                break
                ;;
            *)
                echo "Please enter 1 or 2"
                ;;
        esac
    done
    
    echo
    echo "Selected: $BUILD_TYPE build"
    echo "Command: $BUILD_CMD"
    echo
}

# Function to run the build
run_build() {
    echo "Building the app..."
    echo "Running: $BUILD_CMD"
    echo
    
    if $BUILD_CMD; then
        echo
        echo -e "${GREEN}✓ Build completed successfully!${NC}"
        echo
        echo "The KiCAD Viewer app has been built and is ready to use."
        echo
        if [ "$BUILD_TYPE" = "development" ]; then
            echo "Note: This is a development build. Use 'make' for production deployment."
        fi
    else
        echo
        echo -e "${RED}✗ Build failed!${NC}"
        echo "Please check the error messages above and resolve any issues."
        exit 1
    fi
}

# Main execution
main() {
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "Makefile" ]; then
        echo -e "${RED}Error: This doesn't appear to be the KiCAD Viewer project directory.${NC}"
        echo "Please run this script from the project root directory."
        exit 1
    fi
    
    check_dependencies
    setup_node_deps
    prepare_build_dirs
    choose_build_type
    run_build
    
    echo "Setup complete! 🎉"
}

# Run main function
main "$@"
