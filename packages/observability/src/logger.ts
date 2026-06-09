import type { Logger as LoggerInterface, LogLevel, LogFormat } from './types.js';
import { getCurrentCorrelationId } from './correlation.js';
import { redactSensitiveFields } from './redact.js';

/** Numeric weights for log levels (higher = more severe). */
const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Creates a structured logger that respects the configured level and format.
 *
 * All log output is redacted — any meta fields matching known sensitive patterns
 * are replaced with `'[REDACTED]'`. Correlation identifiers are automatically
 * included in every log entry when a correlation context is active.
 */
export function createLogger(config: { level: LogLevel; format: LogFormat }): LoggerInterface {
  return createLoggerWithBindings(config, {});
}

/**
 * Internal factory that creates a logger with pre-bound root-level bindings.
 */
function createLoggerWithBindings(
  config: { level: LogLevel; format: LogFormat },
  bindings: Record<string, unknown>,
): LoggerInterface {
  const threshold = LEVEL_WEIGHT[config.level];
  const formatJson = config.format === 'json';

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_WEIGHT[level] >= threshold;
  }

  function buildLogEntry(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): Record<string, unknown> {
    const correlationId = getCurrentCorrelationId();

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (correlationId !== undefined) {
      entry['correlationId'] = correlationId;
    }

    // Root-level bindings (e.g. component, route) — redacted
    for (const [key, value] of Object.entries(redactSensitiveFields(bindings))) {
      entry[key] = value;
    }

    // Call-site metadata goes under `data` — redacted
    if (meta !== undefined) {
      entry['data'] = redactSensitiveFields(meta);
    }

    return entry;
  }

  function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog(level)) return;

    const entry = buildLogEntry(level, message, meta);

    if (formatJson) {
      // eslint-disable-next-line no-console
      console[level](JSON.stringify(entry));
    } else {
      const prefix = `[${entry['timestamp'] as string}] ${level.toUpperCase()}`;
      const corr =
        entry['correlationId'] !== undefined ? ` (${entry['correlationId'] as string})` : '';
      // eslint-disable-next-line no-console
      console[level](`${prefix}${corr} ${message}`, meta !== undefined ? entry['data'] : '');
    }
  }

  const debug = (message: string, meta?: Record<string, unknown>): void => {
    write('debug', message, meta);
  };
  const info = (message: string, meta?: Record<string, unknown>): void => {
    write('info', message, meta);
  };
  const warn = (message: string, meta?: Record<string, unknown>): void => {
    write('warn', message, meta);
  };
  const error = (message: string, meta?: Record<string, unknown>): void => {
    write('error', message, meta);
  };

  const child = (moreBindings: Record<string, unknown>): LoggerInterface => {
    return createLoggerWithBindings(config, { ...bindings, ...moreBindings });
  };

  return { debug, info, warn, error, child };
}
