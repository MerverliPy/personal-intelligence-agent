import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { AuditWriter } from '@pia/audit';
import { getCurrentCorrelationId } from '@pia/observability';

export interface RateLimitOptions {
  /** Maximum requests per window (per client IP and route). */
  max?: number;
  /** Time window in seconds. */
  windowSeconds?: number;
}

interface RateEntry {
  count: number;
  resetAt: number;
}

const defaultMax = 100;

const rateLimitPlugin: FastifyPluginAsync<RateLimitOptions> = async (app, opts) => {
  const store = new Map<string, RateEntry>();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 300_000);

  app.addHook('onClose', () => clearInterval(cleanupInterval));

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Route-level config via Fastify 5 routeOptions.config
    const routeConfig = (
      request.routeOptions.config as { rateLimit?: RateLimitOptions } | undefined
    )?.rateLimit;
    const max = routeConfig?.max ?? opts.max ?? defaultMax;
    const windowMs = (routeConfig?.windowSeconds ?? opts.windowSeconds ?? 60) * 1000;

    const ip = request.ip;
    const route = request.routeOptions.url ?? '/';
    const key = `${ip}:${route}`;
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
    } else {
      entry.count++;
      store.set(key, entry);
    }

    void reply.header('X-RateLimit-Limit', String(max));
    void reply.header('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    void reply.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      emitRateLimitAudit(app, request, max);
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          request_id: request.id,
        },
      });
    }
  });
};

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
  fastify: '5.x',
});

function emitRateLimitAudit(app: FastifyInstance, request: FastifyRequest, limit: number): void {
  const auditWriter = app.auditWriter as AuditWriter | undefined;
  if (!auditWriter) return;

  auditWriter.write({
    actorType: 'service',
    action: 'security.rate_limited',
    outcome: 'denied',
    reasonCode: 'RATE_LIMIT_EXCEEDED',
    requestId: getCurrentCorrelationId() ?? request.id,
    resourceType: request.routeOptions.url ?? '/',
    metadata: { ip: request.ip, limit },
  });
}
