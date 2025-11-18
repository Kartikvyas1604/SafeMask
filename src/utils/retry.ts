/**
 * Retry Logic with Exponential Backoff
 * 
 * Provides retry mechanisms for transient failures with:
 * - Exponential backoff
 * - Jitter to prevent thundering herd
 * - Maximum retry limits
 * - Selective retry based on error types
 */

import { isRetryableError } from './errors';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number; // 0 to 1, adds randomness
  retryableErrors?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableErrors: isRetryableError,
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  const { initialDelayMs, maxDelayMs, backoffMultiplier, jitterFactor } = config;
  
  // Exponential backoff: delay = initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
  
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  
  // Add jitter: randomize between (1 - jitter) * delay and (1 + jitter) * delay
  const jitter = 1 + (Math.random() * 2 - 1) * jitterFactor;
  const delayWithJitter = cappedDelay * jitter;
  
  return Math.floor(delayWithJitter);
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const shouldRetry = finalConfig.retryableErrors
        ? finalConfig.retryableErrors(error)
        : isRetryableError(error);

      // If not retryable or out of retries, throw immediately
      if (!shouldRetry || attempt === finalConfig.maxRetries) {
        throw error;
      }

      // Calculate delay for next attempt
      const delayMs = calculateDelay(attempt, finalConfig);

      // Call retry callback
      if (finalConfig.onRetry) {
        finalConfig.onRetry(attempt + 1, error, delayMs);
      }

      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Retry with timeout
 */
export async function retryWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  return Promise.race([
    retryAsync(operation, retryConfig),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    ),
  ]);
}

/**
 * Batch retry - retry multiple operations with shared config
 */
export async function retryBatch<T>(
  operations: Array<() => Promise<T>>,
  config: Partial<RetryConfig> = {}
): Promise<T[]> {
  return Promise.all(operations.map(op => retryAsync(op, config)));
}

/**
 * Retry with fallback - try operation, if fails try fallback
 */
export async function retryWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  try {
    return await retryAsync(primary, config);
  } catch (primaryError) {
    try {
      return await retryAsync(fallback, config);
    } catch (fallbackError) {
      // Throw primary error as it's more relevant
      throw primaryError;
    }
  }
}
