import logger from './logger';

const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_INITIAL_MS = 1000;
const DEFAULT_MAX_MS = 30000;

/**
 * Heuristic: treat as retryable if it looks like throttle, rate limit, or 5xx.
 */
export function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes('throttl') || lower.includes('rate limit') || lower.includes('429')) return true;
  if (lower.includes('503') || lower.includes('502') || lower.includes('500') || lower.includes('504')) return true;
  if (lower.includes('econnreset') || lower.includes('etimedout') || lower.includes('network')) return true;
  return false;
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
}

/**
 * Run an async function with exponential backoff retries on retryable errors.
 * @returns Result of fn()
 * @throws Last error if all retries exhausted
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_MS;
  const isRetryable = options.isRetryable ?? isRetryableError;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries || !isRetryable(err)) {
        throw err;
      }
      const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      logger.warn('RetryWithBackoff: retrying after error', {
        attempt: attempt + 1,
        maxRetries,
        delayMs,
        error: err instanceof Error ? err.message : String(err),
      });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
