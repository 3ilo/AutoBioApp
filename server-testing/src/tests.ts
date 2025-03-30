import { ApiClient } from './api';
import { TEST_USER } from './config';
import logger from './utils/logger';
import { runUserTests } from './tests/userTests';
import { runMemoryTests } from './tests/memoryTests';
import { runAuthTests } from './tests/authTests';

const api = new ApiClient();

async function runTests() {
  try {
    logger.info('Starting API tests...\n');

    // Run auth tests first (they create the test user)
    await runAuthTests();
    logger.info('-------------------\n');

    // Run user tests (they use the test user)
    await runUserTests();
    logger.info('-------------------\n');

    // Run memory tests (they also use the test user)
    await runMemoryTests();

    logger.info('All tests completed successfully!');
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests(); 