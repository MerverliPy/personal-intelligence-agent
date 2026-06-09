/** Severity level for log messages. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Format for log output. */
export type LogFormat = 'json' | 'pretty';

/** Standardized structured logger interface. */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  /** Creates a child logger with additional per-log bindings (e.g. correlationId). */
  child(bindings: Record<string, unknown>): Logger;
}

/** A span within a distributed trace. */
export interface Span {
  /** Sets an attribute on the span. */
  setAttribute(key: string, value: string | number | boolean): void;
  /** Records an event within the span. */
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void;
  /** Sets the span status. */
  setStatus(code: 'ok' | 'error', message?: string): void;
  /** Ends the span. */
  end(): void;
}

/** Trace context carrier for distributed tracing. */
export interface Tracer {
  /** Starts a new span, optionally as a child of the current context span. */
  startSpan(name: string, options?: SpanOptions): Span;
  /** Returns the current trace-id when a context is active. */
  getCurrentTraceId(): string | undefined;
}

export interface SpanOptions {
  /** Additional attributes to set on span creation. */
  attributes?: Record<string, string | number | boolean>;
}

/** A monotonically increasing counter. */
export interface Counter {
  /** Increments the counter by `value` (default 1). */
  inc(value?: number): void;
}

/** A gauge that records a point-in-time value. */
export interface Gauge {
  /** Sets the current value. */
  set(value: number): void;
}

/** A histogram that records a distribution of values. */
export interface Histogram {
  /** Records an observation. */
  record(value: number): void;
}

/** Instrument factory. */
export interface Meter {
  createCounter(name: string, options?: { readonly description?: string }): Counter;
  createGauge(name: string, options?: { readonly description?: string }): Gauge;
  createHistogram(name: string, options?: { readonly description?: string }): Histogram;
}

/** Composite observability context exposed to the application. */
export interface ObservabilityContext {
  logger: Logger;
  tracer: Tracer;
  meter: Meter;
}

/** Configuration for observability components. */
export interface ObservabilityConfig {
  readonly enabled: boolean;
  readonly logLevel: LogLevel;
  readonly logFormat: LogFormat;
}
