import serverless from 'serverless-http';
import app from './index';

// Export the handler for AWS Lambda
export const handler = serverless(app, {
  binary: ['image/*', 'application/octet-stream'],
});

