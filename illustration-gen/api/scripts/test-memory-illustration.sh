#!/bin/bash

# Test script for memory illustration generation endpoint
# Usage: ./test-memory-illustration.sh <EC2_API_URL>
# Example: ./test-memory-illustration.sh http://54.123.45.67:8000

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide the EC2 API URL as a parameter"
    echo "Usage: $0 <EC2_API_URL>"
    echo "Example: $0 http://54.123.45.67:8000"
    exit 1
fi

API_URL="$1"
ENDPOINT="$API_URL/v1/images/memory"

echo "🧪 Testing memory illustration generation..."
echo "📍 Endpoint: $ENDPOINT"

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
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