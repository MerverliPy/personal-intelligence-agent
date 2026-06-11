import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Pool } from 'pg';
import type { AuditWriter, AuditEventInput } from '@pia/audit';
import { createAuditWriter } from '@pia/audit';
import { getCurrentCorrelationId } from '@pia/observability';

declare module 'fastify' {
  interface FastifyInstance {
    auditWriter: AuditWriter;
  }
}

export interface AuditPluginOptions {
  dbPool: Pool;
}

/**
 * Audit logging plugin.
 *
 * Creates an {@link AuditWriter} backed by PostgreSQL and decorates the
 * Fastify instance so that routes and other plugins can emit audit events.
 *
 * Usage in a route handler:
 *   app.auditWriter.write({ ... })
 *
 * The plugin requires a database connection pool. Register after the DB
 * pool is available but before any routes that need audit logging.
 */
const auditPlugin: FastifyPluginAsync<AuditPluginOptions> = async (
  app: FastifyInstance,
  opts: AuditPluginOptions,
) => {
  const auditWriter = createAuditWriter(opts.dbPool);

  app.decorate('auditWriter', auditWriter);

  app.addHook('onClose', async () => {
    // The pool is owned by the caller — we just release the writer reference.
  });
};

export default fp(auditPlugin, {
  name: 'audit',
  fastify: '5.x',
  dependencies: ['correlation', 'auth'],
});

/**
 * Build a canonical audit event from the current request context.
 *
 * Derives `actorId`, `actorType`, and `requestId` automatically from
 * the session and correlation store. Callers can override any optional
 * field via `overrides` (including `actorId` and `actorType`).
 */
export function auditEventFromRequest(
  request: FastifyRequest,
  action: string,
  outcome: AuditEventInput['outcome'],
  overrides?: Partial<Omit<AuditEventInput, 'action' | 'outcome' | 'requestId'>>,
): AuditEventInput {
  const session = request.session;
  const base: AuditEventInput = {
    actorType: 'service',
    action,
    outcome,
    requestId: getCurrentCorrelationId() ?? request.id,
  };

  if (session?.userId) {
    base.actorId = session.userId;
    base.actorType = 'user';
  }

  if (overrides) {
    Object.assign(base, overrides);
  }

  return base;
}
