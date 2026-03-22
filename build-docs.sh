#!/bin/bash

# Documentation Site Build & Serve Script
# Usage: ./build-docs.sh [serve|build|deploy]

set -e

DOCS_DIR="docs/site"
BUILD_DIR="docs/site/dist"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Buzz Documentation Builder${NC}"
echo "================================"

# Function to copy files to build directory
build_site() {
    echo -e "${GREEN}Building documentation site...${NC}"
    
    # Create build directory
    mkdir -p "$BUILD_DIR"
    
    # Copy HTML files
    cp "$DOCS_DIR/index.html" "$BUILD_DIR/"
    mkdir -p "$BUILD_DIR/pages"
    cp -r "$DOCS_DIR/pages/"* "$BUILD_DIR/pages/" 2>/dev/null || true
    
    # Copy assets
    mkdir -p "$BUILD_DIR/assets"
    cp -r "$DOCS_DIR/assets/"* "$BUILD_DIR/assets/" 2>/dev/null || true
    
    echo -e "${GREEN}Build complete! Files are in: $BUILD_DIR${NC}"
}

# Function to serve documentation locally
serve_site() {
    echo -e "${GREEN}Starting local development server...${NC}"
    echo "Documentation will be available at: http://localhost:8000"
    echo "Press Ctrl+C to stop"
    
    cd "$DOCS_DIR"
    python3 -m http.server 8000 2>/dev/null || python -m SimpleHTTPServer 8000
}

# Function to deploy to GitHub Pages
deploy_site() {
    echo -e "${GREEN}Deploying to GitHub Pages...${NC}"
    
    # Build first
    build_site
    
    # Check if gh-pages branch exists
    if git show-ref --verify --quiet refs/heads/gh-pages; then
        echo "gh-pages branch exists"
    else
        echo "Creating gh-pages branch..."
        git checkout --orphan gh-pages
        git reset --hard
        git commit --allow-empty -m "Initialize gh-pages"
        git checkout main
    fi
    
    # Copy build to temp
    cp -r "$BUILD_DIR" /tmp/buzz-docs
    
    # Switch to gh-pages
    git checkout gh-pages
    
    # Clear existing files (except .git)
    find . -maxdepth 1 ! -name '.git' ! -name '.' ! -name '..' -exec rm -rf {} +
    
    # Copy new files
    cp -r /tmp/buzz-docs/* .
    
    # Commit and push
    git add .
    git commit -m "Deploy documentation - $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin gh-pages
    
    # Switch back
    git checkout main
    
    # Cleanup
    rm -rf /tmp/buzz-docs
    
    echo -e "${GREEN}Deployment complete!${NC}"
    echo "Documentation will be available at: https://elight.github.io/buzz-service/"
}

# Main script logic
case "${1:-serve}" in
    serve)
        serve_site
        ;;
    build)
        build_site
        ;;
    deploy)
        deploy_site
        ;;
    *)
        echo "Usage: $0 [serve|build|deploy]"
        echo ""
        echo "Commands:"
        echo "  serve   - Start local development server (default)"
        echo "  build   - Build documentation to dist folder"
        echo "  deploy  - Deploy to GitHub Pages"
        exit 1
        ;;
esac
