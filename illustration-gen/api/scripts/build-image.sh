#!/bin/bash

# Set your AWS account ID (REPLACE THIS)
AWS_ACCOUNT_ID="022499005638"
REGION="us-east-1"
REPO_NAME="auto-bio/illustrations-gen"

echo "Building image for AMD64..."
docker build --platform linux/amd64 -t illustration-generation-api-linux .

echo "Tagging for ECR..."
docker tag illustration-generation-api-linux:latest $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest

echo "Authenticating with ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

echo "Pushing to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest

echo "✅ Image pushed successfully!"