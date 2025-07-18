#!/bin/bash

# AsyncStand Environment Setup Script
# This script copies .env.example files to .env if they don't already exist

set -e

echo "🔧 Setting up environment files for AsyncStand..."

# Function to copy .env.example to .env if .env doesn't exist
setup_env_file() {
    local dir=$1
    local example_file="$dir/.env.example"
    local env_file="$dir/.env"
    
    if [ -f "$example_file" ]; then
        if [ ! -f "$env_file" ]; then
            cp "$example_file" "$env_file"
            echo "✅ Created $env_file from $example_file"
        else
            echo "⏭️  $env_file already exists, skipping"
        fi
    else
        echo "⚠️  $example_file not found, skipping"
    fi
}

# Setup environment files for each app and root
echo "📁 Setting up root environment..."
setup_env_file "."

echo "📁 Setting up backend environment..."
setup_env_file "apps/backend"

echo "📁 Setting up frontend environment..."
setup_env_file "apps/frontend"

echo "📁 Setting up worker environment..."
setup_env_file "apps/worker"

echo ""
echo "🎉 Environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit the .env files with your actual values"
echo "2. Run 'pnpm install' to install dependencies"
echo "3. Run 'pnpm dev' to start all services"
echo "" 