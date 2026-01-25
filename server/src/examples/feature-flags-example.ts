/**
 * Feature Flags Usage Example
 * 
 * This file demonstrates how to use the feature flag system in your code.
 * Run with: npx ts-node src/examples/feature-flags-example.ts
 */

import { featureFlags } from '../services/featureFlagService';

console.log('=== Feature Flags Example ===\n');

// Example 1: Simple flag check
console.log('Example 1: Checking if multi-angle references are enabled');
if (featureFlags.isEnabled('useMultiAngleReferences')) {
  console.log('✓ Multi-angle references are ENABLED');
  console.log('  → Will use 3-view stitched reference images for characters');
} else {
  console.log('✗ Multi-angle references are DISABLED');
  console.log('  → Will use single reference images (original approach)');
}

console.log('\n---\n');

// Example 2: Conditional logic
console.log('Example 2: Conditional feature logic');
const shouldFetchRecentMemories = !featureFlags.isEnabled('disableRecentMemories');
console.log(`Should fetch recent memories: ${shouldFetchRecentMemories}`);

if (shouldFetchRecentMemories) {
  console.log('  → Will fetch and summarize recent memories');
} else {
  console.log('  → Will skip recent memories (faster, less context)');
}

console.log('\n---\n');

// Example 3: Get all flag states
console.log('Example 3: All feature flag states');
const allFlags = featureFlags.getAllFlags();
console.log('Current flag configuration:');
for (const [flagName, isEnabled] of Object.entries(allFlags)) {
  const status = isEnabled ? '✓ ENABLED' : '✗ DISABLED';
  console.log(`  - ${flagName}: ${status}`);
  
  // Show description
  const info = featureFlags.getFlagInfo(flagName);
  if (info?.description) {
    console.log(`    ${info.description}`);
  }
}

console.log('\n---\n');

// Example 4: Real-world usage pattern
console.log('Example 4: Real-world usage in memory illustration');

async function generateMemoryIllustration(characterId: string) {
  console.log(`Generating illustration for character ${characterId}...`);
  
  // Check feature flag to determine which reference to fetch
  if (featureFlags.isEnabled('useMultiAngleReferences')) {
    console.log('  → Fetching multi-angle reference (3 views)...');
    // const reference = await fetchMultiAngleReference(characterId);
    console.log('  → Using stitched 3-angle reference for better fidelity');
  } else {
    console.log('  → Fetching single reference image...');
    // const reference = await fetchSingleReference(characterId);
    console.log('  → Using single reference (faster, lower storage)');
  }
  
  console.log('  ✓ Illustration generated!');
}

// Simulate
generateMemoryIllustration('char-123');

console.log('\n---\n');

// Example 5: Environment variable override demonstration
console.log('Example 5: Environment variable overrides');
console.log('You can override any flag at runtime using environment variables:');
console.log('');
console.log('  # Disable multi-angle references for this run:');
console.log('  USE_MULTI_ANGLE_REFERENCES=false npm start');
console.log('');
console.log('  # Enable recent memories summarization:');
console.log('  DISABLE_RECENT_MEMORIES=false npm start');
console.log('');
console.log('Flag names are converted from camelCase to SCREAMING_SNAKE_CASE');
console.log('  useMultiAngleReferences → USE_MULTI_ANGLE_REFERENCES');
console.log('  disableRecentMemories → DISABLE_RECENT_MEMORIES');

console.log('\n=== End of Examples ===');
