#!/bin/bash
# Script to check staged changes for potential secrets
# This script is designed to run as a git pre-commit hook
# It will fail the commit if secrets are detected

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any issues are found
ISSUES_FOUND=0

echo "🔍 Checking staged changes for secrets..."
echo ""

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}✅ No staged files to check${NC}"
    exit 0
fi

# Check for .env files being committed (but allow .env.example files)
echo "1. Checking for .env files..."
ENV_FILES=$(echo "$STAGED_FILES" | grep -E "\.env$|\.env\." | grep -v "\.env\.example$")
if [ -n "$ENV_FILES" ]; then
    echo -e "${RED}🚨 ERROR: Attempting to commit .env files!${NC}"
    echo "$ENV_FILES"
    echo ""
    echo "Please remove .env files from staging:"
    echo "  git reset HEAD <file>"
    echo "  Add .env to .gitignore if not already present"
    echo ""
    echo "Note: .env.example files are allowed and will not trigger this check."
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✅ No .env files found (excluding .env.example)${NC}"
fi
echo ""

# Check staged content for secrets (exclude .env.example files)
# Get staged files excluding .env.example
STAGED_FILES_FOR_CONTENT=$(echo "$STAGED_FILES" | grep -v "\.env\.example$")
if [ -z "$STAGED_FILES_FOR_CONTENT" ]; then
    # Only .env.example files staged, skip content checks
    STAGED_CONTENT=""
else
    # Get diff for files excluding .env.example
    # Use xargs to handle multiple files correctly
    STAGED_CONTENT=$(echo "$STAGED_FILES_FOR_CONTENT" | xargs git diff --cached --)
fi

# Check for MongoDB connection strings
echo "2. Checking for MongoDB connection strings..."
# Look for actual connection strings with credentials (not just patterns in code)
MONGO=$(echo "$STAGED_CONTENT" | grep -E "mongodb\+srv://[a-zA-Z0-9][^'\"]*@[^'\"]*" | grep -v "user:password\|example\|placeholder\|test\|grep\|check\|script" | head -3)
if [ -n "$MONGO" ]; then
    echo -e "${RED}🚨 ERROR: Found MongoDB connection strings!${NC}"
    echo "$MONGO"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✅ No MongoDB connection strings found${NC}"
fi
echo ""

# Check for AWS keys (AKIA pattern)
echo "3. Checking for AWS access keys..."
AWS_KEYS=$(echo "$STAGED_CONTENT" | grep -E "AKIA[0-9A-Z]{16}" | head -3)
if [ -n "$AWS_KEYS" ]; then
    echo -e "${RED}🚨 ERROR: Found AWS access keys!${NC}"
    echo "$AWS_KEYS"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✅ No AWS keys found${NC}"
fi
echo ""

# Check for AWS secret access keys
echo "4. Checking for AWS secret keys..."
AWS_SECRETS=$(echo "$STAGED_CONTENT" | grep -E "(aws[_-]?secret[_-]?access[_-]?key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['\"][^'\"]{20,}['\"]" -i | head -3)
if [ -n "$AWS_SECRETS" ]; then
    echo -e "${RED}🚨 ERROR: Found AWS secret keys!${NC}"
    echo "$AWS_SECRETS"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✅ No AWS secret keys found${NC}"
fi
echo ""

# Check for hardcoded secrets
echo "5. Checking for hardcoded secrets..."
SECRETS=$(echo "$STAGED_CONTENT" | grep -E "(password|secret|key|token)\s*[:=]\s*['\"][^'\"]{20,}['\"]" -i | grep -v "your-\|example\|placeholder\|test\|spec\|TODO\|FIXME" | head -5)
if [ -n "$SECRETS" ]; then
    echo -e "${YELLOW}⚠️  WARNING: Found potential hardcoded secrets:${NC}"
    echo "$SECRETS"
    echo ""
    echo "Please verify these are not real secrets before committing."
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✅ No suspicious hardcoded secrets found${NC}"
fi
echo ""

# Check for JWT tokens (base64-like strings starting with eyJ)
echo "6. Checking for JWT tokens..."
JWT=$(echo "$STAGED_CONTENT" | grep -E "eyJ[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}" | head -3)
if [ -n "$JWT" ]; then
    echo -e "${RED}🚨 ERROR: Found JWT tokens!${NC}"
    echo "$JWT"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✅ No JWT tokens found${NC}"
fi
echo ""

# Check for API keys (long alphanumeric strings with api key context)
echo "7. Checking for API keys..."
API_KEYS=$(echo "$STAGED_CONTENT" | grep -E "(api[_-]?key|apikey|access[_-]?key)\s*[:=]\s*['\"][A-Za-z0-9]{32,}['\"]" -i | head -3)
if [ -n "$API_KEYS" ]; then
    echo -e "${RED}🚨 ERROR: Found potential API keys!${NC}"
    echo "$API_KEYS"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✅ No API keys found${NC}"
fi
echo ""

echo "8. Checking for private keys..."
PRIVATE_KEYS=$(echo "$STAGED_CONTENT" | grep -E "BEGIN\s+(RSA\s+)?PRIVATE\s+KEY" -i | head -3)
if [ -n "$PRIVATE_KEYS" ]; then
    echo -e "${RED}🚨 ERROR: Found private keys!${NC}"
    echo "$PRIVATE_KEYS"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✅ No private keys found${NC}"
fi
echo ""

# Final result
if [ $ISSUES_FOUND -eq 1 ]; then
    echo -e "${RED}❌ Commit blocked: Secrets detected in staged changes${NC}"
    echo ""
    echo "Please remove secrets from your changes before committing."
    echo "If these are false positives, you can bypass this check with:"
    echo "  git commit --no-verify"
    echo ""
    echo "⚠️  WARNING: Only use --no-verify if you're absolutely sure!"
    exit 1
else
    echo -e "${GREEN}✅ No secrets detected. Proceeding with commit...${NC}"
    exit 0
fi

