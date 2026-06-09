import type { ObservabilityContext, LogLevel, LogFormat } from './types.js';
import { createLogger } from './logger.js';
import { createNoopMeter, createNoopTracer } from './metrics.js';
import type { Logger } from './types.js';

/**
 * Creates the full observability context (logger, tracer, meter) for an
 * application process.
 *
 * When `observability.enabled` is `false` the tracer and meter are no-ops and
 * the logger is suppressed above `error` level. Domain code never needs to
 * inspect enabled/disabled state — if-conditions are contained within this
 * function.
 */
export function createObservability(config: {
  enabled: boolean;
  logLevel: LogLevel;
  logFormat: LogFormat;
}): ObservabilityContext {
  const logger: Logger = config.enabled
    ? createLogger({ level: config.logLevel, format: config.logFormat })
    : createLogger({ level: 'error', format: config.logFormat });

  return {
    logger,
    tracer: config.enabled ? createNoopTracer() : createNoopTracer(),
    meter: config.enabled ? createNoopMeter() : createNoopMeter(),
  };
}

// Re-export everything for consumers
export type {
  Logger,
  Span,
  Tracer,
  Counter,
  Gauge,
  Histogram,
  Meter,
  ObservabilityContext,
  ObservabilityConfig,
  LogLevel,
  LogFormat,
} from './types.js';

export { createLogger } from './logger.js';
export { createNoopMeter, createNoopTracer } from './metrics.js';
export { redactSensitiveFields, redactLogPayload, SENSITIVE_LOG_FIELDS } from './redact.js';
export {
  createCorrelationId,
  createCorrelationContext,
  runWithCorrelation,
  getCorrelationContext,
  getCurrentCorrelationId,
} from './correlation.js';
export type { CorrelationContext } from './correlation.js';
