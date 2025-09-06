#!/usr/bin/env python3
"""
Example usage of the illustration generation API endpoints
"""

import requests
import json

# API base URL
BASE_URL = "http://localhost:8000"

def test_memory_illustration():
    """Test memory illustration generation"""
    url = f"{BASE_URL}/v1/images/memory"
    payload = {
        "user_id": "user123",
        "prompt": "A beautiful sunset over the ocean with waves crashing on the shore",
        "num_inference_steps": 50
    }
    
    print("Testing Memory Illustration Generation...")
    print(f"Request: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")
        return result
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

def test_subject_illustration():
    """Test subject illustration generation"""
    url = f"{BASE_URL}/v1/images/subject"
    payload = {
        "user_id": "user123",
        "num_inference_steps": 50
    }
    
    print("\nTesting Subject Illustration Generation...")
    print(f"Request: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")
        return result
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

def test_health_check():
    """Test health check endpoint"""
    url = f"{BASE_URL}/health/"
    
    print("\nTesting Health Check...")
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")
        return result
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    print("Illustration Generation API Test Suite")
    print("=" * 50)
    
    # Test health check first
    health_result = test_health_check()
    
    if health_result and health_result.get("status") == "healthy":
        print("\n✅ Service is healthy, proceeding with tests...")
        
        # Test memory illustration
        memory_result = test_memory_illustration()
        
        # Test subject illustration
        subject_result = test_subject_illustration()
        
        print("\n" + "=" * 50)
        print("Test Summary:")
        print(f"Health Check: {'✅ PASS' if health_result else '❌ FAIL'}")
        print(f"Memory Illustration: {'✅ PASS' if memory_result else '❌ FAIL'}")
        print(f"Subject Illustration: {'✅ PASS' if subject_result else '❌ FAIL'}")
    else:
        print("\n❌ Service is not healthy, skipping other tests")
