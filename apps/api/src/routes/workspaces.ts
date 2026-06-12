import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createPool } from '@pia/db';
import { evaluatePolicy, createPoolMembershipProvider } from '@pia/auth';
import {
  type Workspace,
  type WorkspacePage,
  type CreateWorkspaceRequest,
  type Project,
  type ProjectPage,
  type CreateProjectRequest,
  type WorkspaceRole,
  type Principal,
  type WorkspaceMembershipSummary,
  normaliseLimit,
  decodeCursor,
  encodeCursor,
} from '@pia/contracts';
import { requireAuth } from '../plugins/auth.js';
import { requireWorkspaceContext } from '../plugins/workspace-context.js';

/**
 * Identity + Workspace + Project routes.
 *
 * Authenticated endpoints:
 * - GET  /v1/me
 * - GET  /v1/workspaces
 * - POST /v1/workspaces
 * - GET  /v1/workspaces/{workspace_id}
 * - GET  /v1/workspaces/{workspace_id}/projects
 * - POST /v1/workspaces/{workspace_id}/projects
 */
const workspaceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const pool = createPool();
  const membership = createPoolMembershipProvider(pool);

  // -----------------------------------------------------------------------
  // GET /v1/me
  // -----------------------------------------------------------------------
  app.get('/v1/me', async (request): Promise<Principal> => {
    const session = requireAuth(request);

    // Query workspace memberships for the current user
    const membershipRows = await pool.query<{
      workspace_id: string;
      role: WorkspaceRole;
    }>(
      `SELECT workspace_id, role
       FROM workspace_members
       WHERE user_id = $1 AND status = 'ACTIVE'`,
      [session.userId],
    );

    const workspaces: WorkspaceMembershipSummary[] = membershipRows.rows.map((r) => ({
      workspace_id: r.workspace_id,
      role: r.role,
    }));

    return {
      id: session.userId,
      email: session.email,
      display_name: session.displayName ?? null,
      workspaces,
    };
  });

  // -----------------------------------------------------------------------
  // GET /v1/workspaces
  // -----------------------------------------------------------------------
  app.get('/v1/workspaces', async (request): Promise<WorkspacePage> => {
    const session = requireAuth(request);

    const cursor = decodeCursor((request.query as Record<string, string> | undefined)?.['cursor']);
    const rawLimit = (request.query as Record<string, string> | undefined)?.['limit'];
    const limit = normaliseLimit(rawLimit !== undefined ? Number(rawLimit) : undefined);

    // Build the query: only workspaces where the user is an active member
    const result = await pool.query<{
      id: string;
      name: string;
      created_at: Date;
    }>(
      `SELECT w.id, w.name, w.created_at
       FROM workspaces w
       INNER JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1
         AND wm.status = 'ACTIVE'
         AND w.deleted_at IS NULL
         ${cursor ? `AND w.created_at < $3` : ''}
       ORDER BY w.created_at DESC
       LIMIT $2`,
      cursor ? [session.userId, limit + 1, cursor] : [session.userId, limit + 1],
    );

    const items: Workspace[] = result.rows.slice(0, limit).map((r) => ({
      id: r.id,
      name: r.name,
      created_at: r.created_at.toISOString(),
    }));

    const hasMore = result.rows.length > limit;
    const nextCursor =
      hasMore && items.length > 0 ? encodeCursor(items[items.length - 1]!.created_at) : null;

    return {
      items,
      ...(nextCursor ? { next_cursor: nextCursor } : { next_cursor: null }),
    };
  });

  // -----------------------------------------------------------------------
  // POST /v1/workspaces
  // -----------------------------------------------------------------------
  app.post(
    '/v1/workspaces',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 120 },
          },
        },
      },
    },
    async (request): Promise<Workspace> => {
      const session = requireAuth(request);
      const body = request.body as CreateWorkspaceRequest;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Create the workspace
        const wsResult = await client.query<{ id: string; name: string; created_at: Date }>(
          `INSERT INTO workspaces (id, name, created_by)
         VALUES (gen_random_uuid(), $1, $2)
         RETURNING id, name, created_at`,
          [body.name, session.userId],
        );
        const ws = wsResult.rows[0]!;

        // Add the creator as OWNER
        await client.query(
          `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'OWNER')`,
          [ws.id, session.userId],
        );

        await client.query('COMMIT');

        return {
          id: ws.id,
          name: ws.name,
          created_at: ws.created_at.toISOString(),
        };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  );

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}
  // -----------------------------------------------------------------------
  app.get('/v1/workspaces/:workspace_id', async (request): Promise<Workspace> => {
    const ctx = await requireWorkspaceContext(request);

    const result = await pool.query<{ id: string; name: string; created_at: Date }>(
      `SELECT id, name, created_at
       FROM workspaces
       WHERE id = $1 AND deleted_at IS NULL`,
      [ctx.workspaceId],
    );

    if (result.rows.length === 0) {
      const err = new Error('Workspace not found.') as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    const ws = result.rows[0]!;
    return {
      id: ws.id,
      name: ws.name,
      created_at: ws.created_at.toISOString(),
    };
  });

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/projects
  // -----------------------------------------------------------------------
  app.get('/v1/workspaces/:workspace_id/projects', async (request): Promise<ProjectPage> => {
    const ctx = await requireWorkspaceContext(request);
    const session = requireAuth(request);

    const cursor = decodeCursor((request.query as Record<string, string> | undefined)?.['cursor']);
    const rawLimit = (request.query as Record<string, string> | undefined)?.['limit'];
    const limit = normaliseLimit(rawLimit !== undefined ? Number(rawLimit) : undefined);

    // Enforce project-level membership: only return projects the user is a member of.
    // The INNER JOIN on project_members ensures AUDITOR-level workspace members
    // cannot enumerate projects they don't belong to.
    const result = await pool.query<{
      id: string;
      workspace_id: string;
      name: string;
      description: string | null;
      created_at: Date;
    }>(
      `SELECT p.id, p.workspace_id, p.name, p.description, p.created_at
       FROM projects p
       INNER JOIN project_members pm ON pm.project_id = p.id
       WHERE p.workspace_id = $1
         AND pm.user_id = $2
         AND pm.status = 'ACTIVE'
         AND p.deleted_at IS NULL
         ${cursor ? `AND p.created_at < $4` : ''}
       ORDER BY p.created_at DESC
       LIMIT $3`,
      cursor
        ? [ctx.workspaceId, session.userId, limit + 1, cursor]
        : [ctx.workspaceId, session.userId, limit + 1],
    );

    const items: Project[] = result.rows.slice(0, limit).map((r) => ({
      id: r.id,
      workspace_id: r.workspace_id,
      name: r.name,
      description: r.description,
      created_at: r.created_at.toISOString(),
    }));

    const hasMore = result.rows.length > limit;
    const nextCursor =
      hasMore && items.length > 0 ? encodeCursor(items[items.length - 1]!.created_at) : null;

    return {
      items,
      ...(nextCursor ? { next_cursor: nextCursor } : { next_cursor: null }),
    };
  });

  // -----------------------------------------------------------------------
  // POST /v1/workspaces/{workspace_id}/projects
  // -----------------------------------------------------------------------
  app.post(
    '/v1/workspaces/:workspace_id/projects',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 160 },
            description: { type: 'string', maxLength: 2000 },
          },
        },
      },
    },
    async (request): Promise<Project> => {
      const ctx = await requireWorkspaceContext(request);
      const session = requireAuth(request);

      // Enforce project:create permission (requires ADMIN per the permission map)
      const createDecision = await evaluatePolicy(membership, {
        userId: session.userId,
        permission: 'project:create',
        workspaceId: ctx.workspaceId,
      });

      if (createDecision.decision !== 'allow') {
        const err = new Error('Access denied.') as Error & { statusCode: number };
        err.statusCode = 403;
        throw err;
      }

      const body = request.body as CreateProjectRequest;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const projResult = await client.query<{
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          created_at: Date;
        }>(
          `INSERT INTO projects (id, workspace_id, name, description, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         RETURNING id, workspace_id, name, description, created_at`,
          [ctx.workspaceId, body.name, body.description ?? null, session.userId],
        );
        const proj = projResult.rows[0]!;

        // Add the creator as project member
        await client.query(
          `INSERT INTO project_members (workspace_id, project_id, user_id, role)
         VALUES ($1, $2, $3, 'OWNER')`,
          [ctx.workspaceId, proj.id, session.userId],
        );

        await client.query('COMMIT');

        return {
          id: proj.id,
          workspace_id: proj.workspace_id,
          name: proj.name,
          description: proj.description,
          created_at: proj.created_at.toISOString(),
        };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  );
};

export default workspaceRoutes;
