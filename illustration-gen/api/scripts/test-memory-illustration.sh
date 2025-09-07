#!/bin/bash

# Test script for memory illustration generation endpoint
# Usage: ./test-memory-illustration.sh <EC2_API_URL> [AUTH_TOKEN]
# Example: ./test-memory-illustration.sh http://54.123.45.67:8000 your-secret-token
# 
# Environment variable fallback:
# Set AUTH_TOKEN_ENV to use as default token if no second argument provided

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide the EC2 API URL as a parameter"
    echo "Usage: $0 <EC2_API_URL> [AUTH_TOKEN]"
    echo "Example: $0 http://54.123.45.67:8000 your-secret-token"
    echo ""
    echo "Environment variable fallback:"
    echo "Set AUTH_TOKEN_ENV to use as default token if no second argument provided"
    exit 1
fi

API_URL="$1"
AUTH_TOKEN="$2"
ENDPOINT="$API_URL/v1/images/memory"

# Use environment variable as fallback if no token provided
if [ -z "$AUTH_TOKEN" ] && [ -n "$AUTH_TOKEN_ENV" ]; then
    AUTH_TOKEN="$AUTH_TOKEN_ENV"
    echo "🔐 Using authentication token from environment variable"
fi

# Build headers
HEADERS=(-H "Content-Type: application/json")
if [ -n "$AUTH_TOKEN" ]; then
    HEADERS+=(-H "Authorization: Bearer $AUTH_TOKEN")
    echo "🔐 Using authentication token"
else
    echo "⚠️  No authentication token provided (set AUTH_TOKEN_ENV or pass as second argument)"
fi

echo "🧪 Testing memory illustration generation..."
echo "📍 Endpoint: $ENDPOINT"

curl -X POST "$ENDPOINT" \
  "${HEADERS[@]}" \
  -d '{
    "user_id": "test_user_123",
    "prompt": "Man sitting on a bench in Central Park, not looking at the camera, its a nice day, sunny, slightly windy",
    "num_inference_steps": 50,
    "ip_adapter_scale": 0.3,
    "negative_prompt": "error, glitch, mistake",
    "style_prompt": "highest quality, monochrome, professional sketch, personal, nostalgic, clean"
  }' \
  -w "\n\n📊 Response Time: %{time_total}s\n📈 HTTP Status: %{http_code}\n"

echo "✅ Memory illustration test completed!"