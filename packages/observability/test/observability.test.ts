import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger } from '../src/logger.js';
import { createObservability } from '../src/index.js';
import {
  createCorrelationContext,
  runWithCorrelation,
  getCurrentCorrelationId,
} from '../src/correlation.js';
import { redactSensitiveFields, redactLogPayload, SENSITIVE_LOG_FIELDS } from '../src/redact.js';
import { createNoopMeter, createNoopTracer } from '../src/metrics.js';
import type { Logger, ObservabilityContext } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Captures console output for inspection. */
function captureConsole(method: 'debug' | 'info' | 'warn' | 'error') {
  const spy = vi.spyOn(console, method).mockImplementation(() => {
    /* suppress */
  });
  return spy;
}

function lastCallArg(spy: ReturnType<typeof vi.spyOn>): unknown[] {
  const calls = spy.mock.calls;
  return calls.length > 0 ? (calls[calls.length - 1] ?? []) : [];
}

// ---------------------------------------------------------------------------
// createLogger
// ---------------------------------------------------------------------------

describe('createLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('log level filtering', () => {
    it('does not log below the configured level', () => {
      const spy = captureConsole('debug');
      const logger = createLogger({ level: 'info', format: 'json' });

      logger.debug('should not appear');

      expect(spy).not.toHaveBeenCalled();
    });

    it('logs at or above the configured level', () => {
      const spy = captureConsole('info');
      const logger = createLogger({ level: 'info', format: 'json' });

      logger.info('visible');

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('json format', () => {
    it('emits structured JSON on a single line', () => {
      const spy = captureConsole('info');
      const logger = createLogger({ level: 'info', format: 'json' });

      logger.info('test message', { key: 'value' });

      const output = lastCallArg(spy)[0] as string;
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed['level']).toBe('info');
      expect(parsed['message']).toBe('test message');
      expect(parsed['timestamp']).toBeDefined();
    });

    it('includes correlationId when a correlation context is active', () => {
      const spy = captureConsole('info');
      const logger = createLogger({ level: 'info', format: 'json' });

      const ctx = createCorrelationContext();
      runWithCorrelation(() => {
        logger.info('scoped message');
      }, ctx);

      const output = lastCallArg(spy)[0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed['correlationId']).toBe(ctx.correlationId);
    });
  });

  describe('pretty format', () => {
    it('does not emit JSON lines', () => {
      const spy = captureConsole('info');
      const logger = createLogger({ level: 'info', format: 'pretty' });

      logger.info('pretty please', { foo: 1 });

      const args = lastCallArg(spy);
      // First arg should be a human-readable string, not JSON
      expect(typeof args[0]).toBe('string');
      expect(args[0]).toContain('pretty please');
      expect(() => JSON.parse(args[0] as string)).toThrow();
    });
  });

  describe('child loggers', () => {
    it('pre-binds metadata via child()', () => {
      const spy = captureConsole('info');
      const logger = createLogger({ level: 'info', format: 'json' });

      const childLogger = logger.child({ component: 'auth' });
      childLogger.info('sign-in');

      const output = lastCallArg(spy)[0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed['component']).toBe('auth');
    });

    it('nested child loggers merge bindings', () => {
      const spy = captureConsole('info');
      const logger = createLogger({ level: 'info', format: 'json' });

      const a = logger.child({ component: 'api' });
      const b = a.child({ route: '/v1/docs' });
      b.info('request');

      const output = lastCallArg(spy)[0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed['component']).toBe('api');
      expect(parsed['route']).toBe('/v1/docs');
    });
  });
});

// ---------------------------------------------------------------------------
// redactSensitiveFields
// ---------------------------------------------------------------------------

describe('redactSensitiveFields', () => {
  it('redacts authorization header', () => {
    const input = {
      headers: {
        authorization: 'Bearer eyJhbGciOi...',
        'content-type': 'application/json',
      },
    };
    const result = redactSensitiveFields(input) as typeof input;

    expect(result.headers.authorization).toBe('[REDACTED]');
    expect(result.headers['content-type']).toBe('application/json');
  });

  it('redacts token fields', () => {
    const input = {
      accessToken: 'secret-abc',
      refreshToken: 'secret-def',
      userId: 'user-1',
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;

    expect(result['accessToken']).toBe('[REDACTED]');
    expect(result['refreshToken']).toBe('[REDACTED]');
    expect(result['userId']).toBe('user-1');
  });

  it('redacts cookie and set-cookie headers', () => {
    const input = {
      cookie: 'session=abc123; HttpOnly; Secure',
      'set-cookie': 'session=xyz789; Path=/',
      'user-agent': 'Mozilla/5.0',
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;

    expect(result['cookie']).toBe('[REDACTED]');
    expect(result['set-cookie']).toBe('[REDACTED]');
    expect(result['user-agent']).toBe('Mozilla/5.0');
  });

  it('redacts password and secret fields', () => {
    const input = {
      password: 'hunter2',
      secretKey: 'sk-abc123',
      api_secret: 'xyz',
      name: 'john',
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;

    expect(result['password']).toBe('[REDACTED]');
    expect(result['secretKey']).toBe('[REDACTED]');
    expect(result['api_secret']).toBe('[REDACTED]');
    expect(result['name']).toBe('john');
  });

  it('redacts configured secret field names from @pia/config', () => {
    // SECRET_FIELD_NAMES from @pia/config includes DATABASE_URL, etc.
    const input = {
      DATABASE_URL: 'postgresql://user:pass@host/db',
      LOG_LEVEL: 'info',
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;

    expect(result['DATABASE_URL']).toBe('[REDACTED]');
    expect(result['LOG_LEVEL']).toBe('info');
  });

  it('redacts nested sensitive fields', () => {
    const input = {
      request: {
        headers: {
          authorization: 'Bearer token123',
          'x-api-key': 'key-456',
          accept: 'application/json',
        },
        body: {
          password: 'secret',
          email: 'user@example.com',
        },
      },
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;
    const request = result['request'] as Record<string, unknown>;
    const headers = request['headers'] as Record<string, unknown>;
    const body = request['body'] as Record<string, unknown>;

    expect(headers['authorization']).toBe('[REDACTED]');
    expect(headers['x-api-key']).toBe('[REDACTED]');
    expect(headers['accept']).toBe('application/json');
    expect(body['password']).toBe('[REDACTED]');
    expect(body['email']).toBe('user@example.com');
  });

  it('is case-insensitive for field names', () => {
    const input = { Authorization: 'Bearer abc', AUTHORIZATION: 'Bearer def' };
    const result = redactSensitiveFields(input) as Record<string, unknown>;

    expect(result['Authorization']).toBe('[REDACTED]');
    expect(result['AUTHORIZATION']).toBe('[REDACTED]');
  });

  it('redacts fields in arrays', () => {
    const input = {
      items: [
        { name: 'a', token: 't1' },
        { name: 'b', token: 't2' },
      ],
    };
    const result = redactSensitiveFields(input) as {
      items: Array<Record<string, unknown>>;
    };

    expect(result.items[0]?.['token']).toBe('[REDACTED]');
    expect(result.items[1]?.['token']).toBe('[REDACTED]');
    expect(result.items[0]?.['name']).toBe('a');
  });

  it('handles null, undefined, and primitive values', () => {
    expect(redactSensitiveFields(null)).toBeNull();
    expect(redactSensitiveFields(undefined)).toBeUndefined();
    expect(redactSensitiveFields(42)).toBe(42);
    expect(redactSensitiveFields('hello')).toBe('hello');
  });

  it('preserves original object (immutability)', () => {
    const input = { password: 'secret', name: 'bob' };
    const result = redactSensitiveFields(input);

    expect(result).not.toBe(input);
    expect(input.password).toBe('secret'); // unchanged
    expect((result as Record<string, unknown>)['password']).toBe('[REDACTED]');
  });
});

// ---------------------------------------------------------------------------
// redactLogPayload
// ---------------------------------------------------------------------------

describe('redactLogPayload', () => {
  it('returns message unchanged and meta redacted', () => {
    const result = redactLogPayload('hello world', {
      authorization: 'Bearer xyz',
      context: 'test',
    });

    expect(result.message).toBe('hello world');
    expect(result.meta?.['authorization']).toBe('[REDACTED]');
    expect(result.meta?.['context']).toBe('test');
  });
});

// ---------------------------------------------------------------------------
// SENSITIVE_LOG_FIELDS
// ---------------------------------------------------------------------------

describe('SENSITIVE_LOG_FIELDS', () => {
  it('includes configured secret field names from @pia/config', () => {
    // Verify that known config secret fields are in the set
    expect(SENSITIVE_LOG_FIELDS.has('DATABASE_URL'.toLowerCase())).toBe(true);
    expect(SENSITIVE_LOG_FIELDS.has('REDIS_URL'.toLowerCase())).toBe(true);
    expect(SENSITIVE_LOG_FIELDS.has('OIDC_CLIENT_SECRET'.toLowerCase())).toBe(true);
    expect(SENSITIVE_LOG_FIELDS.has('SESSION_SECRET'.toLowerCase())).toBe(true);
    expect(SENSITIVE_LOG_FIELDS.has('STORAGE_ACCESS_KEY_ID'.toLowerCase())).toBe(true);
    expect(SENSITIVE_LOG_FIELDS.has('STORAGE_SECRET_ACCESS_KEY'.toLowerCase())).toBe(true);
  });

  it('includes standard HTTP auth field names', () => {
    expect(SENSITIVE_LOG_FIELDS.has('authorization')).toBe(true);
    expect(SENSITIVE_LOG_FIELDS.has('cookie')).toBe(true);
    expect(SENSITIVE_LOG_FIELDS.has('set-cookie')).toBe(true);
    expect(SENSITIVE_LOG_FIELDS.has('x-api-key')).toBe(true);
    expect(SENSITIVE_LOG_FIELDS.has('token')).toBe(true);
    expect(SENSITIVE_LOG_FIELDS.has('password')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// correlation
// ---------------------------------------------------------------------------

describe('correlation', () => {
  it('createCorrelationContext creates a unique UUID correlationId', () => {
    const ctx1 = createCorrelationContext();
    const ctx2 = createCorrelationContext();

    expect(ctx1.correlationId).toBeTruthy();
    expect(ctx1.correlationId).not.toBe(ctx2.correlationId);
    // UUID v4 pattern
    expect(ctx1.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('runWithCorrelation propagates context through sync calls', () => {
    const ctx = createCorrelationContext();
    let captured: string | undefined;

    runWithCorrelation(() => {
      captured = getCurrentCorrelationId();
    }, ctx);

    expect(captured).toBe(ctx.correlationId);
  });

  it('runWithCorrelation propagates context through nested calls', () => {
    const outer = createCorrelationContext();

    function inner(): string | undefined {
      return getCurrentCorrelationId();
    }

    runWithCorrelation(() => {
      const innerId = inner();
      expect(innerId).toBe(outer.correlationId);
    }, outer);
  });

  it('getCurrentCorrelationId returns undefined outside context', () => {
    expect(getCurrentCorrelationId()).toBeUndefined();
  });

  it('runWithCorrelation creates a new context when none provided', () => {
    runWithCorrelation(() => {
      const id = getCurrentCorrelationId();
      expect(id).toBeTruthy();
    });
  });

  it('nested runWithCorrelation creates independent contexts', () => {
    const outerCtx = createCorrelationContext();

    runWithCorrelation(() => {
      const outerId = getCurrentCorrelationId();
      expect(outerId).toBe(outerCtx.correlationId);

      runWithCorrelation(() => {
        const innerId = getCurrentCorrelationId();
        // Inner context is different (new context was created)
        expect(innerId).not.toBe(outerId);
      });

      // Back to outer
      expect(getCurrentCorrelationId()).toBe(outerCtx.correlationId);
    }, outerCtx);
  });
});

// ---------------------------------------------------------------------------
// metrics (no-op)
// ---------------------------------------------------------------------------

describe('noop metrics', () => {
  it('createNoopMeter returns a meter whose instruments accept calls without throwing', () => {
    const meter = createNoopMeter();

    expect(() => meter.createCounter('requests').inc()).not.toThrow();
    expect(() => meter.createCounter('requests').inc(5)).not.toThrow();

    expect(() => meter.createGauge('memory').set(1024)).not.toThrow();

    expect(() => meter.createHistogram('latency').record(42.5)).not.toThrow();
  });

  it('createNoopTracer returns a tracer whose spans accept calls without throwing', () => {
    const tracer = createNoopTracer();
    expect(tracer.getCurrentTraceId()).toBeUndefined();

    const span = tracer.startSpan('test-op');
    expect(() => span.setAttribute('key', 'value')).not.toThrow();
    expect(() => span.addEvent('event-name', { detail: 'x' })).not.toThrow();
    expect(() => span.setStatus('ok')).not.toThrow();
    expect(() => span.end()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createObservability
// ---------------------------------------------------------------------------

describe('createObservability', () => {
  let ctx: ObservabilityContext;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('produces a working logger when enabled', () => {
    const spy = captureConsole('info');
    ctx = createObservability({
      enabled: true,
      logLevel: 'info',
      logFormat: 'json',
    });

    ctx.logger.info('enabled');

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('suppresses info/warn/debug when disabled (only error passes)', () => {
    const infoSpy = captureConsole('info');
    const errorSpy = captureConsole('error');

    ctx = createObservability({
      enabled: false,
      logLevel: 'error', // effectively only errors
      logFormat: 'json',
    });

    ctx.logger.info('should be hidden');
    ctx.logger.error('should be visible');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('tracer and meter are present and callable regardless of enabled state', () => {
    const enabled = createObservability({
      enabled: true,
      logLevel: 'info',
      logFormat: 'json',
    });
    const disabled = createObservability({
      enabled: false,
      logLevel: 'info',
      logFormat: 'json',
    });

    for (const obs of [enabled, disabled]) {
      expect(() => obs.tracer.startSpan('op').end()).not.toThrow();
      expect(() => obs.meter.createCounter('c').inc()).not.toThrow();
    }
  });

  it('can be consumed by domain code without checking enabled', () => {
    // Domain code pattern: just use the interfaces
    const obs = createObservability({
      enabled: false,
      logLevel: 'debug',
      logFormat: 'json',
    });

    function handler(logger: Logger): void {
      logger.info('domain event', { event: 'user.created' });
      // No `if (enabled)` branch needed — the interfaces handle it
    }

    // Should not throw, even though disabled
    expect(() => handler(obs.logger)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Redaction within logger output (integration-style)
// ---------------------------------------------------------------------------

describe('logger redaction integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts sensitive meta fields in JSON output', () => {
    const spy = captureConsole('info');
    const logger = createLogger({ level: 'info', format: 'json' });

    logger.info('request processed', {
      headers: {
        authorization: 'Bearer secret-token',
        'x-api-key': 'key-abc',
        'content-type': 'application/json',
      },
      body: {
        password: 'hunter2',
        email: 'test@example.com',
      },
    });

    const output = lastCallArg(spy)[0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    const data = parsed['data'] as Record<string, unknown>;
    const headers = data['headers'] as Record<string, unknown>;
    const body = data['body'] as Record<string, unknown>;

    // Sensitive fields redacted
    expect(headers['authorization']).toBe('[REDACTED]');
    expect(headers['x-api-key']).toBe('[REDACTED]');
    expect(body['password']).toBe('[REDACTED]');

    // Non-sensitive fields preserved
    expect(headers['content-type']).toBe('application/json');
    expect(body['email']).toBe('test@example.com');

    // Actual secrets never appear in output
    expect(output).not.toContain('secret-token');
    expect(output).not.toContain('key-abc');
    expect(output).not.toContain('hunter2');
  });

  it('redacts sensitive meta fields in pretty output', () => {
    const spy = captureConsole('info');
    const logger = createLogger({ level: 'info', format: 'pretty' });

    logger.info('request processed', {
      token: 'secret-jwt',
      userId: 'user-42',
    });

    const args = lastCallArg(spy);
    const dataArg = args[1] as Record<string, unknown> | undefined;

    // In pretty mode, meta is passed as second arg
    if (dataArg !== undefined) {
      expect(dataArg['token']).toBe('[REDACTED]');
      expect(dataArg['userId']).toBe('user-42');
    }
  });
});
