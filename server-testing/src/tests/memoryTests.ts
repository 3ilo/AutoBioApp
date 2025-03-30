import { ApiClient } from '../api';
import { TEST_USER } from '../config';
import logger from '../utils/logger';
import { setupUnauthenticatedTests, setupAuthenticatedTests } from '../utils/testUtils';

const api = new ApiClient();

async function runUnauthenticatedTests() {
  logger.info('Running unauthenticated memory route tests...\n');
  
  await setupUnauthenticatedTests(api);

  // Test 1: Get memories without auth (should fail - protected route)
  logger.info('Test 1: Get memories without auth (protected route)');
  try {
    await api.get('/memories');
    throw new Error('Should have failed without auth');
  } catch (error: any) {
    if (error.response?.status === 401) {
      logger.info('✓ Unauthenticated access correctly blocked');
    } else {
      throw error;
    }
  }
  logger.info('-------------------\n');

  // Test 2: Create memory without auth (should fail - protected route)
  logger.info('Test 2: Create memory without auth (protected route)');
  try {
    await api.post('/memories', {
      title: 'Test Memory',
      content: 'Test content',
      date: new Date().toISOString(),
    });
    throw new Error('Should have failed without auth');
  } catch (error: any) {
    if (error.response?.status === 401) {
      logger.info('✓ Unauthenticated creation correctly blocked');
    } else {
      throw error;
    }
  }
  logger.info('-------------------\n');

  // Test 3: Update memory without auth (should fail - protected route)
  logger.info('Test 3: Update memory without auth (protected route)');
  try {
    await api.patch('/memories/123', {
      title: 'Updated Memory',
      content: 'Updated content',
    });
    throw new Error('Should have failed without auth');
  } catch (error: any) {
    if (error.response?.status === 401) {
      logger.info('✓ Unauthenticated update correctly blocked');
    } else {
      throw error;
    }
  }
  logger.info('-------------------\n');

  // Test 4: Delete memory without auth (should fail - protected route)
  logger.info('Test 4: Delete memory without auth (protected route)');
  try {
    await api.delete('/memories/123');
    throw new Error('Should have failed without auth');
  } catch (error: any) {
    if (error.response?.status === 401) {
      logger.info('✓ Unauthenticated deletion correctly blocked');
    } else {
      throw error;
    }
  }
  logger.info('-------------------\n');
}

async function runAuthenticatedTests() {
  logger.info('Running authenticated memory route tests...\n');
  
  await setupAuthenticatedTests(api);

  // Test 1: Create memory with auth
  logger.info('Test 1: Create memory with auth');
  let createdMemoryId: string;
  try {
    const createResponse = await api.post('/memories', {
      title: 'Test Memory',
      content: 'Test content',
      date: new Date().toISOString(),
    });
    if (createResponse.status === 'success' && createResponse.data.memory._id) {
      createdMemoryId = createResponse.data.memory._id;
      logger.info('✓ Successfully created memory');
    } else {
      throw new Error('Failed to create memory');
    }
  } catch (error: any) {
    logger.error('Failed to create memory:', error.response?.statusText || error.message);
    throw error;
  }
  logger.info('-------------------\n');

  // Test 2: Get memories with auth
  // TODO: add test to verify authZ
  logger.info('Test 2: Get memories with auth');
  try {
    const response = await api.get('/memories');
    if (response.status === 'success' && Array.isArray(response.data.memories)) {
      logger.info('✓ Successfully retrieved memories with auth');
    } else {
      throw new Error('Failed to get memories');
    }
  } catch (error: any) {
    logger.error('Failed to get memories:', error.response?.statusText || error.message);
    throw error;
  }
  logger.info('-------------------\n');

  // Test 3: Get single memory
  // TODO: add test to verify authZ
  logger.info('Test 3: Get single memory');
  try {
    const response = await api.get(`/memories/${createdMemoryId}`);
    if (response.status === 'success' && response.data.memory._id === createdMemoryId) {
      logger.info('✓ Successfully retrieved single memory');
    } else {
      throw new Error('Failed to get single memory');
    }
  } catch (error: any) {
    logger.error('Failed to get single memory:', error.response?.statusText || error.message);
    throw error;
  }
  logger.info('-------------------\n');

  // Test 4: Update memory
  logger.info('Test 4: Update memory');
  try {
    const updateResponse = await api.patch(`/memories/${createdMemoryId}`, {
      title: 'Updated Memory',
      content: 'Updated content',
    });
    if (updateResponse.status === 'success' && 
        updateResponse.data.memory.title === 'Updated Memory' &&
        updateResponse.data.memory.content === 'Updated content') {
      logger.info('✓ Successfully updated memory');
    } else {
      throw new Error('Failed to update memory');
    }
  } catch (error: any) {
    logger.error('Failed to update memory:', error.response?.statusText || error.message);
    throw error;
  }
  logger.info('-------------------\n');

  // Test 5: Delete memory
  logger.info('Test 5: Delete memory');
  try {
    const deleteResponse = await api.delete(`/memories/${createdMemoryId}`);
    if (deleteResponse.status === 'success') {
      logger.info('✓ Successfully deleted memory');
    } else {
      throw new Error('Failed to delete memory');
    }
  } catch (error: any) {
    logger.error('Failed to delete memory:', error.response?.statusText || error.message);
    throw error;
  }
  logger.info('-------------------\n');

  // Test 6: Verify memory is deleted
  logger.info('Test 6: Verify memory is deleted');
  try {
    await api.get(`/memories/${createdMemoryId}`);
    throw new Error('Memory should have been deleted');
  } catch (error: any) {
    if (error.response?.status === 404) {
      logger.info('✓ Successfully verified memory deletion');
    } else {
      throw error;
    }
  }
  logger.info('-------------------\n');
}

export async function runMemoryTests() {
  try {
    logger.info('Starting memory route tests...\n');

    // Run unauthenticated tests first
    await runUnauthenticatedTests();
    
    // Then run authenticated tests
    await runAuthenticatedTests();

    logger.info('All memory route tests completed successfully!');
  } catch (error) {
    logger.error('Memory route tests failed:', error);
    throw error;
  }
} 