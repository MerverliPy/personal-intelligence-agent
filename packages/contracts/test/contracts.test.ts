import { describe, it, expect } from 'vitest';
import {
  createErrorEnvelope,
  ErrorCodes,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  encodeCursor,
  decodeCursor,
  normaliseLimit,
} from '../src/index.js';

describe('ErrorCodes', () => {
  it('defines all well-known error codes', () => {
    expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
    expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCodes.CONFLICT).toBe('CONFLICT');
    expect(ErrorCodes.IDEMPOTENCY_CONFLICT).toBe('IDEMPOTENCY_CONFLICT');
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCodes.PAYLOAD_TOO_LARGE).toBe('PAYLOAD_TOO_LARGE');
    expect(ErrorCodes.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
    expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
  });

  it('has unique values', () => {
    const values = Object.values(ErrorCodes);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('createErrorEnvelope', () => {
  it('creates an error response with required fields', () => {
    const result = createErrorEnvelope('TEST_CODE', 'Something went wrong', 'req-abc');
    expect(result).toEqual({
      error: {
        code: 'TEST_CODE',
        message: 'Something went wrong',
        request_id: 'req-abc',
      },
    });
  });

  it('includes details when provided', () => {
    const result = createErrorEnvelope('VALIDATION_ERROR', 'Invalid input', 'req-123', {
      field: 'name',
      reason: 'required',
    });
    expect(result.error.details).toEqual({ field: 'name', reason: 'required' });
  });

  it('omits details key when not provided', () => {
    const result = createErrorEnvelope('NOT_FOUND', 'Not found', 'req-456');
    expect(Object.prototype.hasOwnProperty.call(result.error, 'details')).toBe(false);
  });

  it('handles empty string message', () => {
    const result = createErrorEnvelope('CODE', '', 'req-empty');
    expect(result.error.message).toBe('');
  });
});

describe('Pagination constants', () => {
  it('DEFAULT_PAGE_LIMIT is a positive integer', () => {
    expect(Number.isInteger(DEFAULT_PAGE_LIMIT)).toBe(true);
    expect(DEFAULT_PAGE_LIMIT).toBeGreaterThan(0);
  });

  it('MAX_PAGE_LIMIT is a positive integer and >= DEFAULT', () => {
    expect(Number.isInteger(MAX_PAGE_LIMIT)).toBe(true);
    expect(MAX_PAGE_LIMIT).toBeGreaterThanOrEqual(DEFAULT_PAGE_LIMIT);
  });
});

describe('normaliseLimit', () => {
  it('returns DEFAULT_PAGE_LIMIT when limit is undefined', () => {
    expect(normaliseLimit(undefined)).toBe(DEFAULT_PAGE_LIMIT);
  });

  it('returns DEFAULT_PAGE_LIMIT when limit is null', () => {
    expect(normaliseLimit(null as unknown as number)).toBe(DEFAULT_PAGE_LIMIT);
  });

  it('clamps to 1 when limit is below 1', () => {
    expect(normaliseLimit(0)).toBe(1);
    expect(normaliseLimit(-5)).toBe(1);
  });

  it('clamps to MAX_PAGE_LIMIT when limit exceeds max', () => {
    expect(normaliseLimit(MAX_PAGE_LIMIT + 1)).toBe(MAX_PAGE_LIMIT);
    expect(normaliseLimit(9999)).toBe(MAX_PAGE_LIMIT);
  });

  it('returns limit when within bounds', () => {
    expect(normaliseLimit(1)).toBe(1);
    expect(normaliseLimit(25)).toBe(25);
    expect(normaliseLimit(MAX_PAGE_LIMIT)).toBe(MAX_PAGE_LIMIT);
  });
});

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a simple cursor value', () => {
    const encoded = encodeCursor('2024-01-01T00:00:00Z');
    const decoded = decodeCursor(encoded);
    expect(decoded).toBe('2024-01-01T00:00:00Z');
  });

  it('round-trips cursor with special characters', () => {
    const value = '{"id":"a-b","ts":"2024-01-01"}';
    const encoded = encodeCursor(value);
    const decoded = decodeCursor(encoded);
    expect(decoded).toBe(value);
  });

  it('returns undefined for undefined input', () => {
    expect(decodeCursor(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string input', () => {
    expect(decodeCursor('')).toBeUndefined();
  });

  it('returns undefined for malformed input', () => {
    expect(decodeCursor('not-valid-base64!!!')).toBeUndefined();
  });

  it('returns undefined for non-JSON base64 input', () => {
    const nonJson = Buffer.from('hello world').toString('base64url');
    expect(decodeCursor(nonJson)).toBeUndefined();
  });

  it('returns undefined for JSON without "v" key', () => {
    const bad = Buffer.from(JSON.stringify({ x: 'something' })).toString('base64url');
    expect(decodeCursor(bad)).toBeUndefined();
  });

  it('produces distinct encodings for distinct values', () => {
    const a = encodeCursor('cursor-a');
    const b = encodeCursor('cursor-b');
    expect(a).not.toBe(b);
  });
});
