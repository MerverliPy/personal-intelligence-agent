import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createPool } from '@pia/db';
import {
  getDocumentById,
  softDeleteDocument,
  listVersions,
  getDocumentVersionById,
  createIngestionJob,
  getIngestionJobById,
} from '@pia/knowledge';
import type {
  Document,
  DocumentVersion,
  DocumentPage,
  IngestionJob,
  OperationAccepted,
  DocumentVersionStatus,
} from '@pia/contracts';
import { normaliseLimit, decodeCursor, encodeCursor } from '@pia/contracts';
import { requireWorkspaceContext } from '../plugins/workspace-context.js';

/**
 * Document + Ingestion Job routes.
 *
 * @remarks
 * P2-T08 — Expose retrieval and ingestion APIs.
 *
 * Authenticated endpoints:
 * - GET    /v1/workspaces/{workspace_id}/documents
 * - GET    /v1/workspaces/{workspace_id}/documents/{document_id}
 * - DELETE /v1/workspaces/{workspace_id}/documents/{document_id}
 * - POST   /v1/workspaces/{workspace_id}/documents/{document_id}/ingestion-jobs
 * - GET    /v1/workspaces/{workspace_id}/ingestion-jobs/{job_id}
 */
const documentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const pool = createPool();

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Builds a public Document response from a knowledge-package Document entity
   * and its current version if available.
   */
  async function buildDocument(doc: {
    id: string;
    workspaceId: string;
    projectId: string | null;
    title: string;
    sensitivity: string;
    currentVersionId: string | null;
    createdAt: string;
  }): Promise<Document> {
    let currentVersion: DocumentVersion | null = null;
    if (doc.currentVersionId) {
      const versions = await listVersions(pool, doc.workspaceId, doc.id);
      const current = versions.find((v) => v.id === doc.currentVersionId);
      if (current) {
        currentVersion = {
          id: current.id,
          document_id: current.documentId,
          version_number: current.versionNumber,
          status: current.status as DocumentVersionStatus,
          is_current: current.isCurrent,
          checksum_sha256: current.checksumSha256,
          created_at: current.createdAt,
        };
      }
    }

    return {
      id: doc.id,
      workspace_id: doc.workspaceId,
      project_id: doc.projectId,
      title: doc.title,
      sensitivity: doc.sensitivity as Document['sensitivity'],
      current_version: currentVersion,
      created_at: doc.createdAt,
    };
  }

  /**
   * Builds a public IngestionJob response from a knowledge-package entity.
   */
  function buildIngestionJob(job: {
    id: string;
    workspaceId: string;
    documentVersionId: string;
    status: string;
    stage: string | null;
    attempt: number;
    errorCode: string | null;
    errorSafeMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }): IngestionJob {
    return {
      id: job.id,
      document_version_id: job.documentVersionId,
      status: job.status as IngestionJob['status'],
      stage: job.stage,
      attempt: job.attempt,
      error_code: job.errorCode,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
    };
  }

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/documents
  // -----------------------------------------------------------------------
  app.get('/v1/workspaces/:workspace_id/documents', async (request): Promise<DocumentPage> => {
    const ctx = await requireWorkspaceContext(request);
    const params = request.query as Record<string, string> | undefined;

    const cursor = decodeCursor(params?.['cursor']);
    const rawLimit = params?.['limit'];
    const limit = normaliseLimit(rawLimit !== undefined ? Number(rawLimit) : undefined);
    const projectId = params?.['project_id'] as string | undefined;
    const status = params?.['status'] as string | undefined;

    // Use cursor-based pagination on created_at
    const conditions = ['d.workspace_id = $1', 'd.deleted_at IS NULL'];
    const queryParams: unknown[] = [ctx.workspaceId];
    let paramIdx = 2;

    if (projectId) {
      conditions.push(`d.project_id = $${paramIdx}`);
      queryParams.push(projectId);
      paramIdx++;
    }

    if (cursor) {
      conditions.push(`d.created_at < $${paramIdx}`);
      queryParams.push(cursor);
      paramIdx++;
    }

    // Join to document_versions for status filtering
    let fromClause = 'documents d';
    if (status) {
      fromClause = `documents d
        INNER JOIN document_versions dv ON dv.document_id = d.id
          AND dv.status = $${paramIdx}
          AND dv.deleted_at IS NULL`;
      queryParams.push(status);
      paramIdx++;
    }

    const result = await pool.query<{
      id: string;
      workspace_id: string;
      project_id: string | null;
      title: string;
      sensitivity: string;
      current_version_id: string | null;
      created_at: Date;
    }>(
      `SELECT d.id, d.workspace_id, d.project_id, d.title, d.sensitivity, d.current_version_id, d.created_at
       FROM ${fromClause}
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.created_at DESC
       LIMIT $${paramIdx}`,
      [...queryParams, limit + 1],
    );

    const items: Document[] = [];
    for (const row of result.rows.slice(0, limit)) {
      items.push(
        await buildDocument({
          id: row.id,
          workspaceId: row.workspace_id,
          projectId: row.project_id,
          title: row.title,
          sensitivity: row.sensitivity,
          currentVersionId: row.current_version_id,
          createdAt: row.created_at.toISOString(),
        }),
      );
    }

    const hasMore = result.rows.length > limit;
    const nextCursor =
      hasMore && items.length > 0 ? encodeCursor(items[items.length - 1]!.created_at) : null;

    return {
      items,
      ...(nextCursor ? { next_cursor: nextCursor } : { next_cursor: null }),
    };
  });

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/documents/{document_id}
  // -----------------------------------------------------------------------
  app.get(
    '/v1/workspaces/:workspace_id/documents/:document_id',
    async (request): Promise<Document> => {
      const ctx = await requireWorkspaceContext(request);
      const params = request.params as Record<string, string>;
      const documentId = params['document_id']!;

      const doc = await getDocumentById(pool, ctx.workspaceId, documentId);
      if (!doc) {
        const err = new Error('Document not found.') as Error & { statusCode: number };
        err.statusCode = 404;
        throw err;
      }

      return buildDocument(doc);
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /v1/workspaces/{workspace_id}/documents/{document_id}
  // -----------------------------------------------------------------------
  app.delete(
    '/v1/workspaces/:workspace_id/documents/:document_id',
    async (request, reply): Promise<OperationAccepted> => {
      const ctx = await requireWorkspaceContext(request);
      const params = request.params as Record<string, string>;
      const documentId = params['document_id']!;

      const deleted = await softDeleteDocument(pool, ctx.workspaceId, documentId);
      if (!deleted) {
        const err = new Error('Document not found.') as Error & { statusCode: number };
        err.statusCode = 404;
        throw err;
      }

      void reply.code(202);
      return {
        operation_id: documentId,
        status: 'ACCEPTED',
      };
    },
  );

  // -----------------------------------------------------------------------
  // POST /v1/workspaces/{workspace_id}/documents/{document_id}/ingestion-jobs
  // -----------------------------------------------------------------------
  app.post(
    '/v1/workspaces/:workspace_id/documents/:document_id/ingestion-jobs',
    async (request, reply): Promise<IngestionJob> => {
      const ctx = await requireWorkspaceContext(request);
      const params = request.params as Record<string, string>;
      const documentId = params['document_id']!;

      // Verify the document exists and belongs to the workspace
      const doc = await getDocumentById(pool, ctx.workspaceId, documentId);
      if (!doc) {
        const err = new Error('Document not found.') as Error & { statusCode: number };
        err.statusCode = 404;
        throw err;
      }

      // Use the idempotency key header as the idempotency key for the job
      // The idempotency plugin handles key validation and conflict detection
      // The current version's version ID is used for the ingestion job
      const targetVersionId = doc.currentVersionId;
      if (!targetVersionId) {
        const err = new Error('Document has no version to ingest.') as Error & {
          statusCode: number;
        };
        err.statusCode = 400;
        throw err;
      }

      const version = await getDocumentVersionById(pool, ctx.workspaceId, targetVersionId);
      if (!version) {
        const err = new Error('Document version not found.') as Error & { statusCode: number };
        err.statusCode = 404;
        throw err;
      }

      // Only allow re-ingestion for non-READY versions or FAILED versions
      if (
        version.status !== 'FAILED' &&
        version.status !== 'UPLOADED' &&
        version.status !== 'QUARANTINED'
      ) {
        const err = new Error(
          `Document version is in state ${version.status} — cannot create ingestion job.`,
        ) as Error & { statusCode: number };
        err.statusCode = 409;
        throw err;
      }

      const idempotencyKey = (request.headers['idempotency-key'] as string) ?? crypto.randomUUID();

      try {
        const job = await createIngestionJob(pool, {
          workspaceId: ctx.workspaceId,
          documentVersionId: targetVersionId,
          idempotencyKey: `${idempotencyKey}-ingestion`,
          pipelineVersion: version.pipelineVersion ?? '1.0.0',
        });

        void reply.code(202);
        return buildIngestionJob(job);
      } catch (err: unknown) {
        // Narrow to PostgreSQL UNIQUE violation (code 23505) only.
        // Any other error is a genuine failure — re-throw immediately.
        const pgCode = (err as { code?: string }).code;
        if (pgCode !== '23505') {
          throw err;
        }
        // Idempotency: return the most recent existing job for this version
        const result = await pool.query<{
          id: string;
          workspace_id: string;
          document_version_id: string;
          status: string;
          stage: string | null;
          attempt: number;
          error_code: string | null;
          error_safe_message: string | null;
          created_at: string;
          updated_at: string;
        }>(
          `SELECT * FROM ingestion_jobs
           WHERE workspace_id = $1 AND document_version_id = $2
           ORDER BY created_at DESC LIMIT 1`,
          [ctx.workspaceId, targetVersionId],
        );
        if (result.rows.length > 0) {
          const row = result.rows[0]!;
          void reply.code(202);
          return buildIngestionJob({
            id: row.id,
            workspaceId: row.workspace_id,
            documentVersionId: row.document_version_id,
            status: row.status,
            stage: row.stage,
            attempt: row.attempt,
            errorCode: row.error_code,
            errorSafeMessage: row.error_safe_message,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          });
        }
        throw new Error('Failed to create ingestion job.');
      }
    },
  );

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/ingestion-jobs/{job_id}
  // -----------------------------------------------------------------------
  app.get(
    '/v1/workspaces/:workspace_id/ingestion-jobs/:job_id',
    async (request): Promise<IngestionJob> => {
      const ctx = await requireWorkspaceContext(request);
      const params = request.params as Record<string, string>;
      const jobId = params['job_id']!;

      const job = await getIngestionJobById(pool, ctx.workspaceId, jobId);
      if (!job) {
        const err = new Error('Ingestion job not found.') as Error & { statusCode: number };
        err.statusCode = 404;
        throw err;
      }

      return buildIngestionJob(job);
    },
  );
};

export default documentRoutes;
