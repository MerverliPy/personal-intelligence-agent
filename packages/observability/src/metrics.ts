import type { Counter, Gauge, Histogram, Meter, Span, Tracer } from './types.js';

// ---- No-op implementations ----

const noopCounter: Counter = {
  inc: (_value?: number) => {
    /* no-op */
  },
};

const noopGauge: Gauge = {
  set: (_value: number) => {
    /* no-op */
  },
};

const noopHistogram: Histogram = {
  record: (_value: number) => {
    /* no-op */
  },
};

const noopMeter: Meter = {
  createCounter: (_name: string, _options?: { readonly description?: string }): Counter =>
    noopCounter,
  createGauge: (_name: string, _options?: { readonly description?: string }): Gauge => noopGauge,
  createHistogram: (_name: string, _options?: { readonly description?: string }): Histogram =>
    noopHistogram,
};

const noopSpan: Span = {
  setAttribute: (_key: string, _value: string | number | boolean) => {
    /* no-op */
  },
  addEvent: (_name: string, _attributes?: Record<string, string | number | boolean>) => {
    /* no-op */
  },
  setStatus: (_code: 'ok' | 'error', _message?: string) => {
    /* no-op */
  },
  end: () => {
    /* no-op */
  },
};

const noopTracer: Tracer = {
  startSpan: (
    _name: string,
    _options?: {
      readonly attributes?: Record<string, string | number | boolean>;
    },
  ): Span => noopSpan,
  getCurrentTraceId: (): string | undefined => undefined,
};

/**
 * Returns a no-op meter. Use when telemetry is disabled or when running in
 * environments where metrics export is not configured.
 *
 * Applications that depend on this interface are never required to change
 * when telemetry is added or removed.
 */
export function createNoopMeter(): Meter {
  return noopMeter;
}

/**
 * Returns a no-op tracer. Use when tracing is disabled or when an
 * OpenTelemetry exporter is not configured.
 */
export function createNoopTracer(): Tracer {
  return noopTracer;
}
