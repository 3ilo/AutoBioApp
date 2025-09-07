#!/bin/bash

# Set your AWS account ID (REPLACE THIS)
AWS_ACCOUNT_ID="022499005638"
REGION="us-east-1"
REPO_NAME="auto-bio/illustrations-gen"

echo "Building image for AMD64..."
docker build --no-cache -t illustration-generation-api-local .

echo "✅ Image built successfully!"