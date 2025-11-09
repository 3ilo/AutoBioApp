# AutoBio Server Deployment Guide

This guide covers deploying the AutoBio backend to AWS Lambda with API Gateway.

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 20.x installed
3. Serverless Framework installed globally: `npm install -g serverless`
4. MongoDB Atlas or MongoDB instance accessible from AWS Lambda

## Environment Variables

Create a `.env` file in the server directory with the following variables:

```env
# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/autobio

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
REGISTRATION_SECRET=your-registration-secret-password

# Frontend URL (for CORS)
FRONTEND_URL=https://your-username.github.io

# AWS Configuration
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# Illustration Service (for dev, use stub)
USE_ILLUSTRATION_STUB=true
USE_ILLUSTRATION_SERVICE=false
```

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
   ```bash
   serverless deploy --stage dev
   ```

   Or for production:
   ```bash
   serverless deploy --stage prod
   ```

4. **Get the API Gateway URL:**
   After deployment, Serverless will output the API Gateway URL. It will look like:
   ```
   https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
   ```

5. **Update Frontend Environment Variable:**
   Set `VITE_API_URL` in your GitHub repository secrets to the API Gateway URL + `/api`:
   ```
   https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/api
   ```

## Local Testing with Serverless Offline

To test the serverless setup locally:

```bash
serverless offline
```

This will start a local server at `http://localhost:3000` that mimics the Lambda/API Gateway setup.

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

1. **CORS**: The backend only accepts requests from the `FRONTEND_URL` domain
2. **Registration Secret**: Users must provide the registration secret to create accounts
3. **JWT Tokens**: All authenticated endpoints require valid JWT tokens
4. **Environment Variables**: Never commit `.env` files or expose secrets

## Troubleshooting

### MongoDB Connection Issues
- Ensure your MongoDB instance allows connections from AWS Lambda IP ranges
- For MongoDB Atlas, add `0.0.0.0/0` to the IP whitelist (or use VPC peering for production)

### CORS Errors
- Verify `FRONTEND_URL` matches your GitHub Pages URL exactly
- Check that the frontend is sending requests to the correct API Gateway URL

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

