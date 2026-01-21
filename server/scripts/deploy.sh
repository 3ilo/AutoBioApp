#!/bin/bash
# Deployment script that loads .env file before deploying

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get stage from command line or default to dev
STAGE=${1:-dev}
REGION=${2:-us-east-1}

echo -e "${GREEN}🚀 Deploying AutoBio API to AWS (stage: $STAGE)${NC}"
echo ""

# Step 1: Set NODE_ENV based on deployment stage
# This ensures the correct .env.* file is loaded and serverless.yml uses the right value
if [ "$STAGE" == "prod" ]; then
    export NODE_ENV=prod
    ENV_FILE=".env.prod"
elif [ "$STAGE" == "dev" ]; then
    export NODE_ENV=dev
    ENV_FILE=".env.dev"
else
    # Default to dev if stage is unknown
    export NODE_ENV=dev
    ENV_FILE=".env.dev"
fi

echo "📋 Using NODE_ENV=$NODE_ENV for stage $STAGE"

# Step 2: Load stage-specific .env file
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  Warning: $ENV_FILE file not found${NC}"
    echo "Make sure you have a $ENV_FILE file with all required variables."
    echo ""
    echo "You can copy from .env.example and customize:"
    echo "  cp .env.example $ENV_FILE"
    exit 1
fi

echo "📋 Loading stage-specific environment from $ENV_FILE..."
set -a
source "$ENV_FILE"
set +a

# Verify required variables are set
# Note: BACKEND_AWS_KEY and BACKEND_AWS_SECRET are only needed for local development
# They are NOT required for deployment (Lambda uses IAM role)
REQUIRED_VARS=("MONGODB_URI" "JWT_SECRET" "FRONTEND_URL" "S3_BUCKET_NAME")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: Missing required environment variables:${NC}"
    printf '  - %s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "Please ensure all required variables are set in your $ENV_FILE file."
    exit 1
fi

echo -e "${GREEN}✅ All required environment variables are set${NC}"
echo ""

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Reinstall sharp for Linux (Lambda runtime)
# This is necessary because sharp has platform-specific native binaries
# We need to remove it first to ensure clean installation of Linux binaries
echo "📦 Preparing sharp for Lambda (linux-x64)..."

# Remove existing sharp installation to force clean install
rm -rf node_modules/sharp

# Install sharp with Linux binaries
npm install --platform=linux --arch=x64 sharp

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}❌ Failed to install sharp for Linux${NC}"
    exit 1
fi

# Verify Linux binaries are installed
if [ -f "node_modules/sharp/build/Release/sharp-linux-x64.node" ]; then
    echo -e "${GREEN}✅ sharp installed for Linux (verified)${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Linux binaries may not be installed correctly${NC}"
    ls -la node_modules/sharp/build/Release/ 2>/dev/null || echo "Build directory not found"
fi

echo ""

# Deploy with serverless
# NODE_ENV is already set based on stage
echo "☁️  Deploying to AWS (NODE_ENV=$NODE_ENV)..."
serverless deploy --stage $STAGE --region $REGION

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    
    # Restore sharp for local development
    echo ""
    echo "🔄 Restoring sharp for local development..."
    rm -rf node_modules/sharp
    npm install sharp
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ sharp restored with local system binaries${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: Failed to restore sharp${NC}"
        echo "You may need to manually run: npm install sharp"
    fi
    
    echo ""
    echo "Next steps:"
    echo "  1. Create API key: ./scripts/create-api-key.sh $STAGE"
    echo "  2. Add VITE_API_KEY to GitHub secrets"
else
    echo -e "${YELLOW}❌ Deployment failed${NC}"
    exit 1
fi

