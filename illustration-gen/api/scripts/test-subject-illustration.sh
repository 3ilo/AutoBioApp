#!/bin/bash

# Test script for subject illustration generation endpoint
# Usage: ./test-subject-illustration.sh <EC2_API_URL>
# Example: ./test-subject-illustration.sh http://54.123.45.67:8000

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide the EC2 API URL as a parameter"
    echo "Usage: $0 <EC2_API_URL>"
    echo "Example: $0 http://54.123.45.67:8000"
    exit 1
fi

API_URL="$1"
ENDPOINT="$API_URL/v1/images/subject"

echo "🧪 Testing subject illustration generation..."
echo "📍 Endpoint: $ENDPOINT"

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_123",
    "num_inference_steps": 70,
    "ip_adapter_scale": 1.0,
    "negative_prompt": "error, glitch, mistake",
    "style_prompt": "professional sketch portrait"
  }' \
  -w "\n\n📊 Response Time: %{time_total}s\n📈 HTTP Status: %{http_code}\n"

echo "✅ Subject illustration test completed!"