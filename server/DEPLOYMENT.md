# AutoBio Server Deployment Guide

This guide covers deploying the AutoBio backend to AWS Lambda with API Gateway.

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 20.x installed
3. Serverless Framework installed globally: `npm install -g serverless`
4. MongoDB Atlas or MongoDB instance accessible from AWS Lambda

## Environment Variables

The server uses a stage-based environment file system. `NODE_ENV` is set automatically:

- **Local Development**: Set by `package.json` scripts (`NODE_ENV=local`)
- **Dev Deployment**: Set by deploy script (`NODE_ENV=dev`)
- **Prod Deployment**: Set by deploy script (`NODE_ENV=prod`)
- **Lambda Runtime**: Set by `serverless.yml` based on stage

Environment files:
1. **`.env.local`** - Local development variables (loaded when `NODE_ENV=local`)
2. **`.env.dev`** - Development/staging environment variables (loaded when `NODE_ENV=dev`)
3. **`.env.prod`** - Production environment variables (loaded when `NODE_ENV=prod`)

### Setup Steps

1. **Create `.env.local` for local development:**
```env
# Database
MONGODB_URI=mongodb://localhost:27017/autobio

# Authentication
JWT_SECRET=local-dev-jwt-secret-key
JWT_EXPIRES_IN=7d
REGISTRATION_SECRET=local-registration-secret

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# AWS Configuration
AWS_CLIENT_REGION=us-east-1
AWS_STAGING_BUCKET=autobio-local-bucket

# Backend AWS Credentials (required for local development)
BACKEND_AWS_KEY=your-backend-aws-access-key
BACKEND_AWS_SECRET=your-backend-aws-secret-key

# Illustration Service
USE_STUB=true
USE_ILLUSTRATION_SERVICE=false
```

2. **Create `.env.dev` for development deployment:**
```env
# Database
MONGODB_URI=mongodb+srv://dev-user:password@dev-cluster.mongodb.net/autobio_dev

# Authentication
JWT_SECRET=dev-jwt-secret-key
JWT_EXPIRES_IN=7d
REGISTRATION_SECRET=dev-registration-secret

# Frontend URL (for CORS)
FRONTEND_URL=https://milochase.com/AutoBioApp

# AWS Configuration
AWS_CLIENT_REGION=us-east-1
AWS_STAGING_BUCKET=autobio-dev-bucket

# Backend AWS Credentials (optional - only for local testing)
# Not used in Lambda - Lambda uses IAM role
# BACKEND_AWS_KEY=
# BACKEND_AWS_SECRET=

# Illustration Service
USE_STUB=true
USE_ILLUSTRATION_SERVICE=false
```

4. **Create `.env.prod` for production deployment:**
```env
# Database
MONGODB_URI=mongodb+srv://prod-user:password@prod-cluster.mongodb.net/autobio_prod

# Authentication
JWT_SECRET=production-super-secure-jwt-secret
JWT_EXPIRES_IN=7d
REGISTRATION_SECRET=production-registration-secret

# Frontend URL (for CORS)
FRONTEND_URL=https://milochase.com/AutoBioApp

# AWS Configuration
AWS_CLIENT_REGION=us-east-1
AWS_STAGING_BUCKET=autobio-prod-bucket

# Backend AWS Credentials (optional - only for local testing)
# Not used in Lambda - Lambda uses IAM role
# BACKEND_AWS_KEY=
# BACKEND_AWS_SECRET=

# Illustration Service
USE_STUB=false
USE_ILLUSTRATION_SERVICE=true
ILLUSTRATION_SERVICE_URL=https://your-illustration-service.com
ILLUSTRATION_SERVICE_AUTH_TOKEN=production-auth-token
```

### How It Works

- **Local Development**: 
  - Run `npm run dev` or `npm start` → `NODE_ENV=local` is set by package.json script
  - Loads `.env.local` → uses explicit AWS credentials
  
- **Dev Deployment**: 
  - Run `./scripts/deploy.sh dev` → script sets `NODE_ENV=dev`
  - Loads `.env.dev` → Lambda uses IAM role (no credentials needed)
  - `serverless.yml` also sets `NODE_ENV=dev` in Lambda runtime environment
  
- **Prod Deployment**: 
  - Run `./scripts/deploy.sh prod` → script sets `NODE_ENV=prod`
  - Loads `.env.prod` → Lambda uses IAM role (no credentials needed)
  - `serverless.yml` also sets `NODE_ENV=prod` in Lambda runtime environment

The code automatically detects the environment and:
- **Local**: Uses explicit AWS credentials from `.env.local` (BACKEND_AWS_KEY/BACKEND_AWS_SECRET)
- **Dev/Prod**: Uses IAM role (no credentials needed in environment)

## Deployment Steps

1. **Build the TypeScript code:**
   ```bash
   npm run build
   ```

2. **Install Serverless Framework dependencies:**
   ```bash
   npm install
   ```

3. **Deploy to AWS:**
   
   **Using the deployment script (recommended):**
   ```bash
   ./scripts/deploy.sh dev
   ```
   
   Or for production:
   ```bash
   ./scripts/deploy.sh prod
   ```
   
   The script automatically:
   - Loads base `.env` file (for NODE_ENV)
   - Loads stage-specific `.env.dev` or `.env.prod` file
   - Sets NODE_ENV based on stage
   - Deploys with correct environment variables

4. **Get the API Gateway URL:**
   After deployment, Serverless will output the API Gateway URL. It will look like:
   ```
   https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
   ```

5. **Create API Key (if not created automatically):**
   The serverless.yml configuration should automatically create an API key. Check the deployment output for the API key value.
   
   If you need to create it manually, use the provided script:
   ```bash
   cd server
   ./scripts/create-api-key.sh dev
   ```
   
   This will output an API key value that you need to save securely.

6. **Update Frontend Environment Variables:**
   [IMPORTANT] Set these in your GitHub repository secrets:
   
   - `VITE_API_URL`: The API Gateway URL + `/api`
     ```
     https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/api
     ```
   
   - `VITE_API_KEY`: The API key value from step 5
     ```
     your-api-key-value-here
     ```

## Local Testing with Serverless Offline

To test the serverless setup locally:

```bash
serverless offline
```

This will start a local server at `http://localhost:3000` that mimics the Lambda/API Gateway setup.

**Note:** When running locally with `serverless offline`, API keys are not enforced. The `private: true` setting only applies to deployed API Gateway endpoints. For local development, you can test without the API key, or set `VITE_API_KEY` in your local `.env` file if you want to test the API key header inclusion.

## Cost Optimization

For dev testing, the Lambda function is configured with:
- **Memory**: 512 MB (minimum for most workloads)
- **Timeout**: 30 seconds
- **On-demand pricing**: Pay only for requests (very cheap for low traffic)

Expected costs for dev testing:
- Lambda: ~$0.20 per million requests
- API Gateway: ~$3.50 per million requests
- Total: ~$3.70 per million requests (essentially free for dev testing)

## Security Considerations

1. **API Keys**: All API Gateway endpoints require a valid API key in the `x-api-key` header
2. **CORS**: The backend only accepts requests from the `FRONTEND_URL` domain
3. **Registration Secret**: Users must provide the registration secret to create accounts
4. **JWT Tokens**: All authenticated endpoints require valid JWT tokens
5. **Environment Variables**: Never commit `.env` files or expose secrets
6. **Rate Limiting**: Usage plan enforces throttling (50 requests/second, 10,000 requests/day)

## Troubleshooting

### MongoDB Connection Issues
- Ensure your MongoDB instance allows connections from AWS Lambda IP ranges
- For MongoDB Atlas, add `0.0.0.0/0` to the IP whitelist (or use VPC peering for production)

### CORS Errors
- Verify `FRONTEND_URL` matches your GitHub Pages URL exactly
- Check that the frontend is sending requests to the correct API Gateway URL

### API Key Errors
- Verify `VITE_API_KEY` is set in your GitHub repository secrets
- Check that the API key is included in the `x-api-key` header
- Ensure the API key is linked to the usage plan for your stage
- If you get "Forbidden" errors, the API key might be invalid or not linked to the usage plan

### Cold Starts
- Lambda cold starts can take 1-3 seconds on first request
- Consider using provisioned concurrency for production (adds cost)

## Updating Deployment

After making changes:

1. Build: `npm run build`
2. Deploy: `serverless deploy --stage dev`

## Removing Deployment

To remove all AWS resources:

```bash
serverless remove --stage dev
```

