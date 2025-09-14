#!/bin/bash

# Test script for health check endpoint
# Usage: ./test-health.sh <EC2_API_URL>
# Example: ./test-health.sh http://54.123.45.67:8000

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide the EC2 API URL as a parameter"
    echo "Usage: $0 <EC2_API_URL>"
    echo "Example: $0 http://54.123.45.67:8000"
    exit 1
fi

API_URL="$1"
ENDPOINT="$API_URL/"

echo "🏥 Testing health check..."
echo "📍 Endpoint: $ENDPOINT"

curl -X GET "$ENDPOINT" \
  -w "\n\n📊 Response Time: %{time_total}s\n📈 HTTP Status: %{http_code}\n"

echo "✅ Health check completed!"
