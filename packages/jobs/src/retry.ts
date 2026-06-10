import type { RetryPolicy } from './types.js';

/**
 * Default maximum number of processing attempts before a job is moved to the
 * dead-letter state.
 */
const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Base delay in milliseconds used by the default exponential-backoff
 * algorithm.
 */
const DEFAULT_BASE_DELAY_MS = 1_000;

/**
 * Maximum delay in milliseconds for any single retry. Caps the exponential
 * growth to prevent multi-hour waits.
 */
const DEFAULT_MAX_DELAY_MS = 60_000;

/**
 * Creates a retry policy that uses exponential backoff with jitter.
 *
 * - Jobs with fewer attempts than {@link DEFAULT_MAX_ATTEMPTS} are retried.
 * - On the final allowed attempt, the scheduler will try once more; if that
 *   fails the job is terminal.
 * - When the error is a {@link TerminalJobError} the policy immediately
 *   returns `false` regardless of attempt count.
 *
 * @param maxAttempts - Total processing attempts allowed (inclusive).
 * @param baseDelayMs  - Base delay in milliseconds before jitter is applied.
 * @param maxDelayMs   - Ceiling on the computed delay.
 */
export function createExponentialBackoffRetryPolicy(
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs: number = DEFAULT_BASE_DELAY_MS,
  maxDelayMs: number = DEFAULT_MAX_DELAY_MS,
): RetryPolicy {
  return {
    delayMs(attempt: number, error: Error): number | false {
      // Terminal errors should never be retried.
      if (error instanceof Error && error.name === 'TerminalJobError') {
        return false;
      }

      // The current attempt is the attempt that *just* failed.
      // If we've already hit maxAttempts, stop retrying.
      if (attempt >= maxAttempts) {
        return false;
      }

      // Exponential backoff: baseDelay * 2^(attempt-1)
      const rawDelay = baseDelayMs * Math.pow(2, attempt - 1);
      // Apply capped jitter: ±25 %
      const jitter = rawDelay * (0.5 + Math.random() * 0.5);
      const delay = Math.min(jitter, maxDelayMs);

      return Math.round(delay);
    },
  };
}

/**
 * Convenience helper that classifies whether an error is terminal (should
 * never be retried).
 */
export function isTerminalError(error: Error): boolean {
  return error.name === 'TerminalJobError';
}
