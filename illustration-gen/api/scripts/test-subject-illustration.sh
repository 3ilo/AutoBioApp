#!/bin/bash

# Test script for subject illustration generation endpoint
# Usage: ./test-subject-illustration.sh <EC2_API_URL> [AUTH_TOKEN]
# Example: ./test-subject-illustration.sh http://54.123.45.67:8000 your-secret-token

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide the EC2 API URL as a parameter"
    echo "Usage: $0 <EC2_API_URL> [AUTH_TOKEN]"
    echo "Example: $0 http://54.123.45.67:8000 your-secret-token"
    exit 1
fi

API_URL="$1"
AUTH_TOKEN_COMMAND="$2"
ENDPOINT="$API_URL/v1/images/subject"

# Use environment variable as fallback if no token provided
if [ -z "$AUTH_TOKEN" ]; then
    AUTH_TOKEN="${AUTH_TOKEN:-}"
    if [ -n "$AUTH_TOKEN" ]; then
        echo "🔐 Using authentication token from environment variable"
    fi
fi

# Build headers
HEADERS=(-H "Content-Type: application/json")
if [ -n "$AUTH_TOKEN_COMMAND" ]; then
    HEADERS+=(-H "Authorization: Bearer $AUTH_TOKEN_COMMAND")
    echo "🔐 Using authentication token"
else
    echo "⚠️  No authentication token provided"
fi

echo "🧪 Testing subject illustration generation..."
echo "📍 Endpoint: $ENDPOINT"

curl -X POST "$ENDPOINT" \
  "${HEADERS[@]}" \
  -d '{
    "user_id": "test_user_123",
    "num_inference_steps": 70,
    "ip_adapter_scale": 1.3,
    "negative_prompt": "error, glitch, mistake",
    "style_prompt": "professional sketch portrait"
  }' \
  -w "\n\n📊 Response Time: %{time_total}s\n📈 HTTP Status: %{http_code}\n"

echo "✅ Subject illustration test completed!"