#!/bin/bash

# Test script for all endpoints
# Usage: ./test-all-endpoints.sh <EC2_API_URL>
# Example: ./test-all-endpoints.sh http://54.123.45.67:8000

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide the EC2 API URL as a parameter"
    echo "Usage: $0 <EC2_API_URL>"
    echo "Example: $0 http://54.123.45.67:8000"
    exit 1
fi

API_URL="$1"

echo "🚀 Testing all endpoints for AutoBio Illustration API"
echo "📍 API Base URL: $API_URL"
echo "=================================================="

# Test health endpoint
echo ""
echo "1️⃣ Testing Health Check..."
curl -X GET "$API_URL/health" \
  -w "\n📊 Response Time: %{time_total}s | HTTP Status: %{http_code}\n"

# Test root endpoint
echo ""
echo "2️⃣ Testing Root Endpoint..."
curl -X GET "$API_URL/" \
  -w "\n📊 Response Time: %{time_total}s | HTTP Status: %{http_code}\n"

# Test memory illustration endpoint
echo ""
echo "3️⃣ Testing Memory Illustration Generation..."
curl -X POST "$API_URL/v1/images/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_123",
    "prompt": "A beautiful sunset over mountains with a peaceful lake",
    "num_inference_steps": 50
  }' \
  -w "\n📊 Response Time: %{time_total}s | HTTP Status: %{http_code}\n"

# Test subject illustration endpoint
echo ""
echo "4️⃣ Testing Subject Illustration Generation..."
curl -X POST "$API_URL/v1/images/subject" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_123",
    "num_inference_steps": 50
  }' \
  -w "\n📊 Response Time: %{time_total}s | HTTP Status: %{http_code}\n"

echo ""
echo "✅ All endpoint tests completed!"
echo "=================================================="
