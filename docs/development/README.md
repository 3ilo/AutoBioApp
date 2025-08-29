# Development Setup Guide

Complete guide for setting up the AutoBio development environment.

## Prerequisites

### Required Software
- **Node.js**: Version 14 or higher
- **npm**: Version 6 or higher (comes with Node.js)
- **MongoDB**: Version 4.4 or higher
- **Git**: Version control system

### Optional Software
- **Docker**: For containerized development
- **MongoDB Compass**: GUI for MongoDB
- **Postman**: API testing tool
- **VS Code**: Recommended IDE with extensions

## Initial Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd AutoBio
```

### 2. Install Dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies (if working on frontend)
cd ../client
npm install
```

### 3. Environment Configuration

Create environment files for both server and client:

#### Server Environment (.env)
```bash
cd server
cp .env.example .env
```

Configure the following variables:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/autobio_dev

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# AWS Configuration (for AI and storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name

# Optional: Logging
LOG_LEVEL=debug
```

#### Client Environment (.env)
```bash
cd client
cp .env.example .env
```

Configure the following variables:
```env
# API Configuration
VITE_API_URL=http://localhost:3000/api

# Feature Flags
VITE_AUTH_ENABLED=true
VITE_ENABLE_IMAGE_GENERATION=true
VITE_ENABLE_SOCIAL_FEATURES=true

# App Configuration
VITE_APP_NAME=AutoBio
VITE_APP_DESCRIPTION=Capture and preserve your life's precious moments
```

### 4. Database Setup

#### Local MongoDB Installation
```bash
# macOS (using Homebrew)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community

# Ubuntu/Debian
sudo apt update
sudo apt install mongodb
sudo systemctl start mongodb

# Windows
# Download and install from https://www.mongodb.com/try/download/community
```

#### Create Database
```bash
# Connect to MongoDB
mongosh

# Create database
use autobio_dev

# Create collections (optional - will be created automatically)
db.createCollection('users')
db.createCollection('memories')

# Exit
exit
```

### 5. AWS Setup (for AI and Storage)

#### Create AWS Account
1. Sign up for AWS account
2. Create IAM user with programmatic access
3. Attach policies for S3 and Bedrock access

#### Configure AWS CLI (optional)
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region
```

## Development Workflow

### Starting the Development Servers

#### Server Development
```bash
cd server
npm run dev
```
Server will be available at `http://localhost:3000`

#### Client Development
```bash
cd client
npm run dev
```
Client will be available at `http://localhost:5173`

### Available Scripts

#### Server Scripts
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
npm test             # Run test suite
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

#### Client Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

### Code Quality Tools

#### ESLint Configuration
The project uses ESLint with TypeScript support:
```bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

#### TypeScript Configuration
```bash
# Type checking
npm run type-check
```

#### Pre-commit Hooks (Recommended)
Install husky for pre-commit hooks:
```bash
npm install --save-dev husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npm run lint && npm run type-check"
```

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test:suite --test=auth
```

### Test Structure
```
server/src/tests/
├── setup.ts          # Test setup and configuration
├── auth.test.ts      # Authentication tests
├── memory.test.ts    # Memory CRUD tests
└── user.test.ts      # User management tests
```

### Writing Tests
Follow the existing test patterns:
```typescript
describe('Feature', () => {
  it('should perform expected behavior', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## Debugging

### Server Debugging
```bash
# Start with debugging enabled
npm run dev -- --inspect

# Or use VS Code debugger
# Create .vscode/launch.json configuration
```

### Database Debugging
```bash
# Connect to MongoDB shell
mongosh autobio_dev

# View collections
show collections

# Query data
db.users.find()
db.memories.find()
```

### API Testing
Use Postman or curl for API testing:
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test authentication
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password123"}'
```

## Common Issues and Solutions

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
brew services list | grep mongodb

# Restart MongoDB
brew services restart mongodb/brew/mongodb-community
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### AWS Credentials Issues
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check environment variables
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
```

### TypeScript Compilation Errors
```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

## Contributing Guidelines

### Code Style
- Follow existing code patterns
- Use TypeScript strict mode
- Write meaningful commit messages
- Add tests for new functionality

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create pull request
git push origin feature/your-feature-name
```

### Documentation
- Update README files for significant changes
- Document new API endpoints
- Add inline comments for complex logic
- Update environment variable documentation
