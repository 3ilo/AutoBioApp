/**
 * Utility functions for generating deep links to memories
 */

/**
 * Generate a URL to a specific memory in the memories carousel
 * @param memoryId - The ID of the memory to link to
 * @returns URL path with memoryId query parameter
 */
export function getMemoryLink(memoryId: string | undefined): string {
  if (!memoryId) {
    return '/memories';
  }
  return `/memories?memoryId=${encodeURIComponent(memoryId)}`;
}

/**
 * Generate a URL to the memories page (without specific memory)
 * @returns URL path to memories page
 */
export function getMemoriesPageLink(): string {
  return '/memories';
}

