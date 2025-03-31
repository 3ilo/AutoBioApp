import { ApiClient } from '../api';
import { TEST_USER } from '../config';
import logger from '../utils/logger';

const api = new ApiClient();

export async function runAuthTests() {
  try {
    logger.info('Starting auth route tests...\n');

    // Test 1: Try to register with valid data
    logger.info('Test 1: Register with valid data');
    try {
      const registerResponse = await api.post('/auth/register', TEST_USER);
      if (registerResponse.status === 'success' && 
          registerResponse.data.user.email === TEST_USER.email) {
        logger.info('✓ Successfully registered user');
      } else {
        throw new Error('Failed to register user');
      }
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.message === 'Email already in use') {
        logger.info('✓ User already exists, proceeding with login');
      } else {
        logger.error('Registration failed:', error.response?.statusText || error.message);
        throw error;
      }
    }
    logger.info('-------------------\n');

    // Test 2: Register with duplicate email (should fail)
    logger.info('Test 2: Register with duplicate email');
    try {
      await api.post('/auth/register', TEST_USER);
      throw new Error('Should have failed with duplicate email');
    } catch (error: any) {
      if (error.response?.status === 400) {
        logger.info('✓ Duplicate registration correctly blocked');
      } else {
        logger.error('Unexpected error:', error.response?.statusText || error.message);
        throw error;
      }
    }
    logger.info('-------------------\n');

    // Test 3: Login with valid credentials
    logger.info('Test 3: Login with valid credentials');
    try {
      const loginResponse = await api.post('/auth/login', {
        email: TEST_USER.email,
        password: TEST_USER.password,
      });
      if (loginResponse.status === 'success' && 
          loginResponse.data.user.email === TEST_USER.email &&
          loginResponse.data.token) {
        logger.info('✓ Successfully logged in');
        api.setToken(loginResponse.data.token);
      } else {
        throw new Error('Failed to login');
      }
    } catch (error: any) {
      logger.error('Login failed:', error.response?.statusText || error.message);
      throw error;
    }
    logger.info('-------------------\n');

    // Test 4: Login with invalid password (should fail)
    logger.info('Test 4: Login with invalid password');
    try {
      await api.post('/auth/login', {
        email: TEST_USER.email,
        password: 'wrongpassword',
      });
      throw new Error('Should have failed with invalid password');
    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.info('✓ Invalid password correctly blocked');
      } else {
        logger.error('Unexpected error:', error.response?.statusText || error.message);
        throw error;
      }
    }
    logger.info('-------------------\n');

    // Test 5: Login with non-existent email (should fail)
    logger.info('Test 5: Login with non-existent email');
    try {
      await api.post('/auth/login', {
        email: 'nonexistent@example.com',
        password: 'password123',
      });
      throw new Error('Should have failed with non-existent email');
    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.info('✓ Non-existent email correctly blocked');
      } else {
        logger.error('Unexpected error:', error.response?.statusText || error.message);
        throw error;
      }
    }
    logger.info('-------------------\n');

    logger.info('All auth route tests completed successfully!');
  } catch (error) {
    logger.error('Auth route tests failed:', error);
    throw error;
  }
} 