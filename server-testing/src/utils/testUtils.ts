import { ApiClient } from '../api';
import { TEST_USER } from '../config';
import logger from './logger';

export async function setupUnauthenticatedTests(api: ApiClient) {
  // Clear any existing token
  api.setToken(null);
}

export async function setupAuthenticatedTests(api: ApiClient) {
  // Login with test user
  logger.info('Setting up authenticated tests - logging in...');
  try {
    const loginResponse = await api.post('/auth/login', {
      email: TEST_USER.email,
      password: TEST_USER.password,
    });
    if (loginResponse.status === 'success' && 
      loginResponse.data.user.email === TEST_USER.email) {
      logger.info('✓ Successfully logged in for tests');
      logger.info("loginResponse.data.user", loginResponse.data.user);
      // Verify token is working by making a test request
      const verifyResponse = await api.get('/users/me');
      logger.info("verifyResponse", verifyResponse);
      if (verifyResponse.status === 'success' && 
          verifyResponse.data.user.email === TEST_USER.email) {
        logger.info('✓ Token verified successfully');
      } else {
        throw new Error('Token verification failed');
      }
    } else {
      throw new Error('Failed to login for tests');
    }
  } catch (error: any) {
    logger.error('Login failed during test setup:', error.response?.statusText || error.message);
    throw error;
  }
} 