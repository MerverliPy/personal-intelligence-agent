import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Correlation context scoped to an async execution (request, job, etc.).
 * Uses Node.js AsyncLocalStorage to propagate context through the call chain.
 */
export interface CorrelationContext {
  /** Unique correlation identifier. */
  correlationId: string;
  /** Optional trace/parent id for distributed tracing. */
  traceId?: string;
  /** Optional span id for the current operation. */
  spanId?: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Creates a new unique correlation identifier (UUID v4).
 */
export function createCorrelationId(): string {
  return randomUUID();
}

/**
 * Creates a new correlation context with a fresh correlation ID.
 */
export function createCorrelationContext(traceId?: string, spanId?: string): CorrelationContext {
  const ctx: CorrelationContext = {
    correlationId: createCorrelationId(),
  };
  if (traceId !== undefined) {
    ctx.traceId = traceId;
  }
  if (spanId !== undefined) {
    ctx.spanId = spanId;
  }
  return ctx;
}

/**
 * Runs the given function within a new correlation context.
 * The context is available to `getCorrelationContext()` during the execution.
 */
export function runWithCorrelation<T>(fn: () => T, context?: CorrelationContext): T {
  const ctx = context ?? createCorrelationContext();
  return storage.run(ctx, fn);
}

/**
 * Returns the current correlation context, or `undefined` when not inside a
 * `runWithCorrelation` call.
 */
export function getCorrelationContext(): CorrelationContext | undefined {
  return storage.getStore();
}

/**
 * Returns the current correlation ID, or `undefined`.
 */
export function getCurrentCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
