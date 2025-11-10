/**
 * Centralized environment configuration
 * Determines the current environment and provides utilities for environment-specific behavior
 */

export type Environment = 'local' | 'dev' | 'prod';

/**
 * Gets the current environment from NODE_ENV
 * Defaults to 'local' if not set
 */
export function getEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV;
  
  if (nodeEnv === 'production' || nodeEnv === 'prod') {
    return 'prod';
  }
  
  if (nodeEnv === 'development' || nodeEnv === 'dev') {
    return 'dev';
  }
  
  // Default to local
  return 'local';
}

/**
 * Checks if running in serverless environment (dev or prod)
 * Only local development is not serverless
 */
export function isServerless(): boolean {
  const env = getEnvironment();
  return env === 'dev' || env === 'prod';
}

/**
 * Checks if running locally (not in serverless)
 */
export function isLocal(): boolean {
  return !isServerless();
}

/**
 * Gets AWS SDK client configuration
 * Returns credentials only for local development
 * In dev/prod (serverless), uses IAM role automatically
 */
export function getAwsClientConfig(region: string): { 
  region: string; 
  credentials?: { accessKeyId: string; secretAccessKey: string } 
} {
  const config: any = {
    region,
  };
  
  // Only use explicit credentials for local development
  // In dev/prod (serverless), the IAM role provides credentials automatically
  if (isLocal() && process.env.BACKEND_AWS_KEY) {
    config.credentials = {
      accessKeyId: process.env.BACKEND_AWS_KEY,
      secretAccessKey: process.env.BACKEND_AWS_SECRET || '',
    };
  }
  
  return config;
}

// Export current environment for convenience
export const ENV = getEnvironment();
export const IS_SERVERLESS = isServerless();
export const IS_LOCAL = isLocal();

