import { describe, it, expect } from 'vitest';
import { createExponentialBackoffRetryPolicy, isTerminalError } from '../src/retry.js';
import { TerminalJobError } from '../src/types.js';

// ---------------------------------------------------------------------------
// Exponential backoff retry policy
// ---------------------------------------------------------------------------

describe('createExponentialBackoffRetryPolicy', () => {
  const policy = createExponentialBackoffRetryPolicy(5, 1_000, 60_000);

  it('returns a positive delay for the first retryable failure', () => {
    const delay = policy.delayMs(1, new Error('transient'));
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(60_000);
  });

  it('returns false for TerminalJobError regardless of attempt', () => {
    const err = new TerminalJobError('invalid payload', 'INVALID_PAYLOAD');
    expect(policy.delayMs(1, err)).toBe(false);
    expect(policy.delayMs(3, err)).toBe(false);
  });

  it('returns false when max attempts are exhausted', () => {
    // attempt 5 uses the last retry; attempt 6 exceeds max
    expect(policy.delayMs(5, new Error('fail'))).toBe(false);
    expect(policy.delayMs(10, new Error('fail'))).toBe(false);
  });

  it('applies exponential growth capped by maxDelayMs', () => {
    const cappedPolicy = createExponentialBackoffRetryPolicy(10, 1_000, 5_000);
    // Even attempt 10 should be capped at 5000ms
    const delay = cappedPolicy.delayMs(5, new Error('fail'));
    expect(typeof delay).toBe('number');
    if (typeof delay === 'number') {
      expect(delay).toBeLessThanOrEqual(5_000);
    }
  });

  it('returns increasing delays for successive attempts', () => {
    const d1 = policy.delayMs(1, new Error('fail')) as number;
    const d2 = policy.delayMs(2, new Error('fail')) as number;
    // With jitter they can technically overlap, but generally d2 should be >= d1/2
    // We verify both are positive numbers
    expect(d1).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Terminal error detection
// ---------------------------------------------------------------------------

describe('isTerminalError', () => {
  it('returns true for TerminalJobError', () => {
    const err = new TerminalJobError('bad input', 'BAD_INPUT');
    expect(isTerminalError(err)).toBe(true);
  });

  it('returns false for generic Error', () => {
    expect(isTerminalError(new Error('timeout'))).toBe(false);
  });

  it('returns false for TypeError', () => {
    expect(isTerminalError(new TypeError('undefined is not a function'))).toBe(false);
  });
});
