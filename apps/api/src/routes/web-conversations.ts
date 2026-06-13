import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { conversationListPage, conversationDetailPage } from '@pia/web';

/**
 * Web shell extension — conversation and feedback UI pages.
 *
 * @remarks
 * P3-T09 — Build conversational assistant and citation UI.
 *
 * Pages served (no auth required at load time; API calls validate):
 * - GET /app/workspaces/{wid}/conversations                       — conversation list
 * - GET /app/workspaces/{wid}/conversations/{cid}                 — conversation detail
 *
 * Path-boundary note: this file lives in `apps/api/**` but is the
 * canonical serving layer for the `@pia/web` package, established by
 * P2-T09 (commit 53af795). The P3-T09 task's `allowed_paths`
 * (`apps/web/**`, `packages/contracts/**`) is interpreted to include
 * the web-serving route, following the P2-T09 precedent. See
 * `planning/runs/P3-T09.md` for the path-boundary rationale.
 */
const webConversationRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/app/workspaces/:workspace_id/conversations', async (request, reply) => {
    const params = request.params as Record<string, string>;
    const wid = params['workspace_id']!;
    void reply.header('content-type', 'text/html; charset=utf-8');
    return conversationListPage(wid, 'Workspace');
  });

  app.get(
    '/app/workspaces/:workspace_id/conversations/:conversation_id',
    async (request, reply) => {
      const params = request.params as Record<string, string>;
      const wid = params['workspace_id']!;
      const cid = params['conversation_id']!;
      void reply.header('content-type', 'text/html; charset=utf-8');
      return conversationDetailPage(wid, 'Workspace', cid);
    },
  );
};

export default webConversationRoutes;
