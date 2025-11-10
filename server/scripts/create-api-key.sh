#!/bin/bash
# Script to create API Gateway API key and usage plan
# Run this after deploying your serverless function

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔑 Creating API Gateway API Key and Usage Plan..."
echo ""

# Get stage from command line or default to dev
STAGE=${1:-dev}
REGION=${2:-us-east-1}

# Get API Gateway REST API ID
echo "📡 Finding API Gateway REST API..."
API_ID=$(aws apigateway get-rest-apis --region $REGION --query "items[?name=='autobio-api-$STAGE'].id" --output text)

if [ -z "$API_ID" ]; then
    echo -e "${RED}❌ Error: Could not find API Gateway REST API for stage '$STAGE'${NC}"
    echo "Make sure you've deployed your serverless function first:"
    echo "  cd server && serverless deploy --stage $STAGE"
    exit 1
fi

echo -e "${GREEN}✅ Found API Gateway: $API_ID${NC}"
echo ""

# Create API Key
echo "🔑 Creating API Key..."
API_KEY_RESPONSE=$(aws apigateway create-api-key \
    --name "autobio-api-$STAGE-api-key" \
    --description "API key for AutoBio frontend" \
    --enabled \
    --region $REGION \
    --query '{Id: id, Value: value}' \
    --output json)

API_KEY_ID=$(echo $API_KEY_RESPONSE | jq -r '.Id')
API_KEY_VALUE=$(echo $API_KEY_RESPONSE | jq -r '.Value')

if [ -z "$API_KEY_ID" ] || [ "$API_KEY_ID" == "null" ]; then
    echo -e "${RED}❌ Error: Failed to create API key${NC}"
    exit 1
fi

echo -e "${GREEN}✅ API Key created: $API_KEY_ID${NC}"
echo ""

# Create Usage Plan
echo "📋 Creating Usage Plan..."
USAGE_PLAN_RESPONSE=$(aws apigateway create-usage-plan \
    --name "autobio-api-$STAGE-usage-plan" \
    --description "Usage plan for AutoBio API" \
    --api-stages "[{\"apiId\":\"$API_ID\",\"stage\":\"$STAGE\"}]" \
    --throttle "burstLimit=100,rateLimit=50" \
    --quota "limit=10000,period=DAY" \
    --region $REGION \
    --query '{Id: id}' \
    --output json)

USAGE_PLAN_ID=$(echo $USAGE_PLAN_RESPONSE | jq -r '.Id')

if [ -z "$USAGE_PLAN_ID" ] || [ "$USAGE_PLAN_ID" == "null" ]; then
    echo -e "${RED}❌ Error: Failed to create usage plan${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Usage Plan created: $USAGE_PLAN_ID${NC}"
echo ""

# Link API Key to Usage Plan
echo "🔗 Linking API Key to Usage Plan..."
aws apigateway create-usage-plan-key \
    --usage-plan-id $USAGE_PLAN_ID \
    --key-type API_KEY \
    --key-id $API_KEY_ID \
    --region $REGION > /dev/null

echo -e "${GREEN}✅ API Key linked to Usage Plan${NC}"
echo ""

# Output results
echo -e "${GREEN}✅ API Key setup complete!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  IMPORTANT: Save this API key securely!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "API Key ID: $API_KEY_ID"
echo "API Key Value: $API_KEY_VALUE"
echo ""
echo "Add this to your GitHub repository secrets:"
echo "  Name: VITE_API_KEY"
echo "  Value: $API_KEY_VALUE"
echo ""
echo "Or add to your .env file for local development:"
echo "  VITE_API_KEY=$API_KEY_VALUE"
echo ""

