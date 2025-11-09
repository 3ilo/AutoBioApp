#!/bin/bash
# Script to check git history for potential secrets
# Run this before making repo public

echo "🔍 Checking git history for secrets..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for .env files in history
echo "1. Checking for .env files in git history..."
ENV_FILES=$(git log --all --full-history --source -- "*\.env" --oneline 2>/dev/null)
if [ -z "$ENV_FILES" ]; then
    echo -e "${GREEN}✅ No .env files found in history${NC}"
else
    echo -e "${YELLOW}⚠️  Found .env files in history:${NC}"
    echo "$ENV_FILES"
    echo ""
    echo "Checking content..."
    git log --all --full-history -p --source -- "*\.env" | grep -E "(password|secret|key|token|mongodb|aws)" -i | head -5
fi
echo ""

# Check for MongoDB connection strings
echo "2. Checking for MongoDB connection strings..."
MONGO=$(git log --all --full-history -S "mongodb+srv://" --source --oneline 2>/dev/null)
if [ -z "$MONGO" ]; then
    echo -e "${GREEN}✅ No MongoDB connection strings found${NC}"
else
    echo -e "${YELLOW}⚠️  Found MongoDB references:${NC}"
    echo "$MONGO"
    echo "Checking if they're real or examples..."
    git log --all --full-history -p -S "mongodb+srv://" | grep "mongodb+srv://" | grep -v "user:password\|example\|placeholder" | head -3
fi
echo ""

# Check for AWS keys
echo "3. Checking for AWS access keys (AKIA pattern)..."
AWS_KEYS=$(git log --all --full-history -S "AKIA" --source --oneline 2>/dev/null)
if [ -z "$AWS_KEYS" ]; then
    echo -e "${GREEN}✅ No AWS keys found${NC}"
else
    echo -e "${RED}🚨 Found AWS key references!${NC}"
    echo "$AWS_KEYS"
fi
echo ""

# Check for hardcoded secrets in code
echo "4. Checking for hardcoded secrets (long strings)..."
SECRETS=$(git log --all --full-history -p | grep -E "(password|secret|key|token)\s*[:=]\s*['\"][^'\"]{20,}['\"]" -i | grep -v "your-\|example\|placeholder\|test\|spec" | head -5)
if [ -z "$SECRETS" ]; then
    echo -e "${GREEN}✅ No suspicious hardcoded secrets found${NC}"
else
    echo -e "${YELLOW}⚠️  Found potential secrets:${NC}"
    echo "$SECRETS"
fi
echo ""

# Check for JWT tokens (base64-like strings)
echo "5. Checking for JWT tokens (eyJ pattern)..."
JWT=$(git log --all --full-history -p | grep -E "eyJ[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}" | head -3)
if [ -z "$JWT" ]; then
    echo -e "${GREEN}✅ No JWT tokens found${NC}"
else
    echo -e "${RED}🚨 Found JWT tokens!${NC}"
    echo "$JWT"
fi
echo ""

# Check for API keys
echo "6. Checking for API keys (long alphanumeric strings)..."
API_KEYS=$(git log --all --full-history -p | grep -E "['\"][A-Za-z0-9]{32,}['\"]" | grep -E "(api[_-]?key|apikey|access[_-]?key)" -i | head -3)
if [ -z "$API_KEYS" ]; then
    echo -e "${GREEN}✅ No API keys found${NC}"
else
    echo -e "${YELLOW}⚠️  Found potential API keys:${NC}"
    echo "$API_KEYS"
fi
echo ""

echo "✅ Git history scan complete!"
echo ""
echo "If any secrets were found, you may need to:"
echo "  1. Rotate the compromised secrets immediately"
echo "  2. Remove them from git history using git filter-branch or BFG"
echo "  3. Force push (if repo is not yet public, this is safe)"

