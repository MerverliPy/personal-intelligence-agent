import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { documentListPage, documentDetailPage, uploadPage, searchPage } from '@pia/web';

/**
 * Web shell extension — document and retrieval UI pages.
 *
 * @remarks
 * P2-T09 — Build document and retrieval user interface.
 *
 * Pages served (no auth required at load time; API calls validate):
 * - GET /app/workspaces/{wid}/documents        — document list
 * - GET /app/workspaces/{wid}/documents/{did}  — document detail
 * - GET /app/workspaces/{wid}/upload           — upload form
 * - GET /app/workspaces/{wid}/search           — retrieval search
 *
 * Workspace names are fetched from the API at page load; for the initial
 * HTML we use a placeholder that the client JS will replace.
 */
const webDocumentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/app/workspaces/:workspace_id/documents', async (request, reply) => {
    const params = request.params as Record<string, string>;
    const wid = params['workspace_id']!;
    void reply.header('content-type', 'text/html; charset=utf-8');
    return documentListPage(wid, 'Workspace');
  });

  app.get('/app/workspaces/:workspace_id/documents/:document_id', async (request, reply) => {
    const params = request.params as Record<string, string>;
    const wid = params['workspace_id']!;
    const did = params['document_id']!;
    void reply.header('content-type', 'text/html; charset=utf-8');
    return documentDetailPage(wid, 'Workspace', did);
  });

  app.get('/app/workspaces/:workspace_id/upload', async (request, reply) => {
    const params = request.params as Record<string, string>;
    const wid = params['workspace_id']!;
    void reply.header('content-type', 'text/html; charset=utf-8');
    return uploadPage(wid, 'Workspace');
  });

  app.get('/app/workspaces/:workspace_id/search', async (request, reply) => {
    const params = request.params as Record<string, string>;
    const wid = params['workspace_id']!;
    void reply.header('content-type', 'text/html; charset=utf-8');
    return searchPage(wid, 'Workspace');
  });
};

export default webDocumentRoutes;
