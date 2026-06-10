import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createPool } from '@pia/db';
import { evaluatePolicy, createPoolMembershipProvider, type MembershipProvider } from '@pia/auth';

/**
 * Extended Fastify request with resolved workspace context.
 */
declare module 'fastify' {
  interface FastifyRequest {
    /** Resolved workspace context, set after successful authorization. */
    workspaceContext?: WorkspaceContext;
  }
}

export interface WorkspaceContext {
  workspaceId: string;
  role: string;
}

/**
 * Workspace context plugin options.
 */
export interface WorkspacePluginOptions {
  membershipProvider?: MembershipProvider;
}

/**
 * Creates a default membership provider backed by the database pool.
 */
function defaultMembershipProvider(): MembershipProvider {
  const pool = createPool();
  return createPoolMembershipProvider(pool);
}

/**
 * Workspace context plugin.
 *
 * Does NOT enforce authorization — that is the route handler's
 * responsibility. It pre-computes common workspace metadata from
 * the URL when a `workspace_id` param is present.
 */
const workspaceContextPlugin: FastifyPluginAsync<WorkspacePluginOptions> = async (
  app: FastifyInstance,
  opts: WorkspacePluginOptions = {},
) => {
  const membership = opts.membershipProvider ?? defaultMembershipProvider();

  app.decorateRequest('workspaceContext', undefined);

  // Pre-resolve workspace context on requests that have a workspace_id param
  app.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    const params = request.params as Record<string, string> | undefined;
    const workspaceId = params?.['workspace_id'];
    if (!workspaceId) return;

    const session = request.session;
    if (!session) return;

    const decision = await evaluatePolicy(membership, {
      userId: session.userId,
      permission: 'workspace:read',
      workspaceId,
    });

    if (decision.decision === 'allow') {
      request.workspaceContext = {
        workspaceId,
        role: decision.reasonCode ?? 'MEMBER',
      };
    }
  });
};

/**
 * Helper that ensures the workspace context is resolved and authorized.
 *
 * - Requires authentication (401 if missing).
 * - Requires workspace membership with at least `workspace:read` (403 if denied).
 *
 * Returns the resolved {@link WorkspaceContext}.
 */
export async function requireWorkspaceContext(request: FastifyRequest): Promise<WorkspaceContext> {
  if (!request.session) {
    const err = new Error('Authentication required.') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  if (!request.workspaceContext) {
    const err = new Error('Access denied.') as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  return request.workspaceContext;
}

export default fp(workspaceContextPlugin, {
  name: 'workspace-context',
  fastify: '5.x',
  dependencies: ['auth'],
});
