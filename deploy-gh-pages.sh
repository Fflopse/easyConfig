#!/bin/bash

# Ensure we're in the project directory
cd "$(dirname "$0")"

# Check if gh-pages is installed
if ! npm list gh-pages --depth=0 >/dev/null 2>&1; then
  echo "Installing gh-pages..."
  npm install gh-pages --save-dev
fi

# Prompt for GitHub username and repo name
read -p "Enter your GitHub username: " username
read -p "Enter your repository name: " repo_name

# Update package.json
jq '.homepage = "https://config.fflopse.de"' package.json > temp.json && mv temp.json package.json
jq '.scripts.predeploy = "npm run build"' package.json > temp.json && mv temp.json package.json
jq '.scripts.deploy = "gh-pages -d build"' package.json > temp.json && mv temp.json package.json

# Create or update .env file
echo "PUBLIC_URL=https://config.fflopse.de" > .env

# Set remote URL to HTTPS
git remote set-url origin https:npm//github.com/$username/$repo_name.git

# Build and deploy
GIT_USER=$username npm run deploy

echo "Deployment complete! Please check your GitHub repository settings to ensure the 'Pages' source is set to 'gh-pages branch'."