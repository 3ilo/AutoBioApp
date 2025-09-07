#!/bin/bash

# Test script for authentication
# Usage: ./test-auth.sh <EC2_API_URL> [AUTH_TOKEN]
# Example: ./test-auth.sh http://54.123.45.67:8000 your-secret-token

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide the EC2 API URL as a parameter"
    echo "Usage: $0 <EC2_API_URL> [AUTH_TOKEN]"
    echo "Example: $0 http://54.123.45.67:8000 your-secret-token"
    exit 1
fi

API_URL="$1"
AUTH_TOKEN="$2"
ENDPOINT="$API_URL/v1/images/memory"

echo "🧪 Testing authentication..."
echo "📍 Endpoint: $ENDPOINT"

# Test without authentication
echo ""
echo "🔓 Testing without authentication (should fail if auth is enabled):"
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_123",
    "prompt": "Test prompt"
  }' \
  -w "\n📈 HTTP Status: %{http_code}\n" \
  -s

# Test with authentication (if token provided)
if [ -n "$AUTH_TOKEN" ]; then
    echo ""
    echo "🔐 Testing with authentication:"
    curl -X POST "$ENDPOINT" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -d '{
        "user_id": "test_user_123",
        "prompt": "Test prompt"
      }' \
      -w "\n📈 HTTP Status: %{http_code}\n" \
      -s
else
    echo ""
    echo "⚠️  No authentication token provided - skipping auth test"
fi

echo ""
echo "✅ Authentication test completed!"
