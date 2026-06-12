import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createPool } from '@pia/db';
import { RetrievalService, fakeEmbeddingProvider, defaultFakeModelConfig } from '@pia/knowledge';
import type { RetrievalQueryRequest, RetrievalResponse, RetrievalResult } from '@pia/contracts';
import { requireAuth } from '../plugins/auth.js';
import { requireWorkspaceContext } from '../plugins/workspace-context.js';

/**
 * Retrieval routes.
 *
 * @remarks
 * P2-T08 — Expose retrieval and ingestion APIs.
 *
 * Authenticated endpoints:
 * - POST /v1/workspaces/{workspace_id}/retrieval/query
 * - GET  /v1/workspaces/{workspace_id}/retrieval/traces/{trace_id}
 */
const retrievalRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const pool = createPool();

  // Initialize the retrieval service with default config.
  // In production, this would use a real embedding provider configured
  // from typed config. For now it uses the deterministic fake provider.
  const retrievalService = new RetrievalService({
    pool,
    embeddingProvider: fakeEmbeddingProvider,
    embeddingModelConfig: defaultFakeModelConfig(),
  });

  // -----------------------------------------------------------------------
  // POST /v1/workspaces/{workspace_id}/retrieval/query
  // -----------------------------------------------------------------------
  app.post(
    '/v1/workspaces/:workspace_id/retrieval/query',
    {
      schema: {
        body: {
          type: 'object',
          required: ['query'],
          additionalProperties: false,
          properties: {
            query: { type: 'string', minLength: 1, maxLength: 10000 },
            project_id: { type: 'string', format: 'uuid' },
            source_ids: {
              type: 'array',
              maxItems: 100,
              items: { type: 'string', format: 'uuid' },
            },
            history_mode: {
              type: 'string',
              enum: ['CURRENT_ONLY', 'INCLUDE_HISTORY'],
            },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
            include_debug: { type: 'boolean', default: false },
          },
        },
      },
    },
    async (request): Promise<RetrievalResponse> => {
      const ctx = await requireWorkspaceContext(request);
      const session = requireAuth(request);
      const body = request.body as RetrievalQueryRequest;

      const includeHistorical = body.history_mode === 'INCLUDE_HISTORY';

      const projectId = body.project_id ?? undefined;
      const sourceId = body.source_ids?.[0];

      // Execute retrieval through the authorized service.
      // Build query as a plain object to avoid exactOptionalPropertyTypes
      // conflicts with readonly optional interface properties.
      const retrievalQuery = {
        queryText: body.query,
        workspaceId: ctx.workspaceId,
        maxResults: body.limit ?? 10,
        includeHistorical,
        scoreThreshold: 0,
        ...(projectId ? { projectId, allowedProjectIds: [projectId] as const } : {}),
        ...(sourceId ? { sourceId } : {}),
      };

      const response = await retrievalService.retrieve(
        retrievalQuery as Parameters<typeof retrievalService.retrieve>[0],
        session.userId,
      );

      // Transform internal results to API contract shape
      const apiResults: RetrievalResult[] = response.results.map((r, i) => {
        const result: RetrievalResult = {
          rank: i + 1,
          chunk_id: r.chunkId,
          document_id: r.documentId,
          document_version_id: r.documentVersionId,
          locator: r.locator as RetrievalResult['locator'],
          text: r.text,
          scores: {
            lexical: r.lexicalScore,
            vector: r.vectorScore,
            fused: r.fusedScore,
          },
        };
        if (r.sourceId) {
          result.source_id = r.sourceId;
        }
        return result;
      });

      return {
        trace_id: response.traceId,
        configuration_version: '1.0.0',
        results: apiResults,
        latency_ms: response.latencyMs,
      };
    },
  );

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/retrieval/traces/{trace_id}
  // -----------------------------------------------------------------------
  app.get(
    '/v1/workspaces/:workspace_id/retrieval/traces/:trace_id',
    async (request): Promise<RetrievalResponse> => {
      const ctx = await requireWorkspaceContext(request);
      const session = requireAuth(request);
      const params = request.params as Record<string, string>;
      const traceId = params['trace_id']!;

      // Debug retrieval detail is role-gated (per spec)
      // Check if user has auditor or admin role for debug access
      // For now, we gate detailed trace info by checking roles
      const roleCheck = await pool.query<{ role: string }>(
        `SELECT role FROM workspace_members
         WHERE workspace_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
        [ctx.workspaceId, session.userId],
      );

      const userRole = roleCheck.rows[0]?.role;
      const canViewTrace = userRole === 'AUDITOR' || userRole === 'ADMIN' || userRole === 'OWNER';

      if (!canViewTrace) {
        const err = new Error(
          'Access denied — retrieval trace inspection requires elevated role.',
        ) as Error & { statusCode: number };
        err.statusCode = 403;
        throw err;
      }

      // Query the trace record
      const traceResult = await pool.query<{
        id: string;
        workspace_id: string;
        retrieval_config_id: string;
        query_text: string;
        filters: Record<string, unknown>;
        result_count: number;
        latency_ms: number;
        created_at: string;
      }>(
        `SELECT id, workspace_id, retrieval_config_id, query_text, filters, result_count, latency_ms, created_at
         FROM retrieval_traces
         WHERE workspace_id = $1 AND id = $2`,
        [ctx.workspaceId, traceId],
      );

      if (traceResult.rows.length === 0) {
        const err = new Error('Retrieval trace not found.') as Error & { statusCode: number };
        err.statusCode = 404;
        throw err;
      }

      const trace = traceResult.rows[0]!;

      // Query the result rows for this trace
      const resultsResult = await pool.query<{
        retrieval_trace_id: string;
        rank: number;
        chunk_id: string;
        lexical_score: number | null;
        vector_score: number | null;
        fused_score: number;
      }>(
        `SELECT rr.retrieval_trace_id, rr.rank, rr.chunk_id,
                rr.lexical_score, rr.vector_score, rr.fused_score
         FROM retrieval_results rr
         WHERE rr.retrieval_trace_id = $1
         ORDER BY rr.rank`,
        [traceId],
      );

      // Enrich results with chunk data
      const apiResults: RetrievalResult[] = [];
      for (const rr of resultsResult.rows) {
        const chunkResult = await pool.query<{
          id: string;
          document_id: string;
          document_version_id: string;
          content: string;
          locator: Record<string, unknown>;
          source_id: string | null;
        }>(
          `SELECT dc.id, dc.document_id, dc.document_version_id, dc.content, dc.locator, d.source_id
           FROM document_chunks dc
           LEFT JOIN documents d ON d.id = dc.document_id
           WHERE dc.id = $1`,
          [rr.chunk_id],
        );

        const chunk = chunkResult.rows[0];

        const result: RetrievalResult = {
          rank: rr.rank,
          chunk_id: rr.chunk_id,
          document_id: chunk?.document_id ?? '',
          document_version_id: chunk?.document_version_id ?? '',
          locator: (chunk?.locator as RetrievalResult['locator']) ?? {},
          text: chunk?.content ?? '',
          scores: {
            lexical: rr.lexical_score,
            vector: rr.vector_score,
            fused: rr.fused_score,
          },
        };
        if (chunk?.source_id) {
          result.source_id = chunk.source_id;
        }
        apiResults.push(result);
      }

      return {
        trace_id: trace.id,
        configuration_version: '1.0.0',
        results: apiResults,
        latency_ms: trace.latency_ms,
      };
    },
  );
};

export default retrievalRoutes;
