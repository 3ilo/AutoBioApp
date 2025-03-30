import { ApiClient } from '../api';
import { TEST_USER } from '../config';
import logger from '../utils/logger';
import { setupUnauthenticatedTests, setupAuthenticatedTests } from '../utils/testUtils';

const api = new ApiClient();

async function runUnauthenticatedTests() {
  logger.info('Running unauthenticated user route tests...\n');
  
  await setupUnauthenticatedTests(api);

  // Test 1: Get current user without auth (should fail)
  logger.info('Test 1: Get current user without auth');
  try {
    await api.get('/users/me');
    throw new Error('Should have failed without auth');
  } catch (error: any) {
    if (error.response?.status === 401) {
      logger.info('✓ Unauthenticated access correctly blocked');
    } else {
      throw error;
    }
  }
  logger.info('-------------------\n');

  // Test 2: Update user without auth (should fail)
  logger.info('Test 2: Update user without auth');
  try {
    await api.put('/users/me', { name: 'New Name' });
    throw new Error('Should have failed without auth');
  } catch (error: any) {
    if (error.response?.status === 401) {
      logger.info('✓ Unauthenticated update correctly blocked');
    } else {
      throw error;
    }
  }
  logger.info('-------------------\n');
}

async function runAuthenticatedTests() {
  logger.info('Running authenticated user route tests...\n');
  
  await setupAuthenticatedTests(api);

  // Test 1: Get current user with auth
  logger.info('Test 1: Get current user with auth');
  try {
    const userResponse = await api.get('/users/me');
    if (userResponse.status === 'success' && 
        userResponse.data.user.email === TEST_USER.email) {
      logger.info('✓ Successfully retrieved user profile');
    } else {
      throw new Error('Failed to get user profile');
    }
  } catch (error: any) {
    logger.error('Failed to get user profile:', error.response?.statusText || error.message);
    throw error;
  }
  logger.info('-------------------\n');

  // Test 2: Update user with auth
  logger.info('Test 2: Update user with auth');
  try {
    const updateResponse = await api.put('/users/me', {
      name: 'Updated Name',
      bio: 'Updated bio',
    });
    if (updateResponse.status === 'success' && 
        updateResponse.data.user.name === 'Updated Name' &&
        updateResponse.data.user.bio === 'Updated bio') {
      logger.info('✓ Successfully updated user profile');
    } else {
      throw new Error('Failed to update user profile');
    }
  } catch (error: any) {
    logger.error('Failed to update user profile:', error.response?.statusText || error.message);
    throw error;
  }
  logger.info('-------------------\n');

  // Test 3: Update user with invalid fields
  logger.info('Test 3: Update user with invalid fields');
  try {
    await api.put('/users/me', {
      email: 'invalid-email',
      password: 'short', // too short
    });
    throw new Error('Should have failed with invalid fields');
  } catch (error: any) {
    if (error.response?.status === 400) {
      logger.info('✓ Invalid update fields correctly blocked');
    } else {
      logger.error('Unexpected error:', error.response?.statusText || error.message);
      throw error;
    }
  }
  logger.info('-------------------\n');
}

export async function runUserTests() {
  try {
    logger.info('Starting user route tests...\n');

    // Run unauthenticated tests first
    await runUnauthenticatedTests();
    
    // Then run authenticated tests
    await runAuthenticatedTests();

    logger.info('All user route tests completed successfully!');
  } catch (error) {
    logger.error('User route tests failed:', error);
    throw error;
  }
}

// Run the tests
runUserTests(); 