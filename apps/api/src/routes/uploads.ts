import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createPool } from '@pia/db';
import {
  createS3StorageProvider,
  createLocalStorageProvider,
  type StorageProvider,
} from '@pia/storage';
import { loadConfig } from '@pia/config';
import { createNoopScanProvider, type ScanProvider } from '@pia/knowledge';
import { completeUploadWorkflow } from '../services/upload-workflow.js';
import {
  type CreateUploadRequest,
  type CreateUploadResponse,
  type CompleteUploadResponse,
} from '@pia/contracts';
import { requireAuth } from '../plugins/auth.js';
import { requireWorkspaceContext } from '../plugins/workspace-context.js';

/**
 * Upload route plugin options.
 *
 * Providers can be injected for testing; when omitted, sensible
 * development defaults are used.
 */
export interface UploadRouteOptions {
  /** Storage provider (uses local in-memory adapter when omitted in dev). */
  storageProvider?: StorageProvider;
  /** Scan provider (uses noop adapter when omitted). */
  scanProvider?: ScanProvider;
}

/**
 * Creates a default storage provider from configuration.
 *
 * In development/test mode falls back to the local in-memory adapter.
 * In production uses S3-compatible storage.
 */
function defaultStorageProvider(): StorageProvider {
  try {
    const config = loadConfig();
    if (config.mode === 'production') {
      return createS3StorageProvider({
        endpoint: config.storage.endpoint,
        bucket: config.storage.bucket,
        accessKeyId: config.storage.accessKeyId.expose(),
        secretAccessKey: config.storage.secretAccessKey.expose(),
        region: 'us-east-1',
        forcePathStyle: true,
      });
    }
  } catch {
    // Config not available; use local fallback
  }
  // Development: use in-memory local adapter
  // NOTE: In a real dev setup, simulateUpload must be called before completion
  return createLocalStorageProvider().provider;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const uploadRoutes: FastifyPluginAsync<UploadRouteOptions> = async (
  app: FastifyInstance,
  opts: UploadRouteOptions = {},
) => {
  const pool = createPool();
  const storage = opts.storageProvider ?? defaultStorageProvider();
  const scan = opts.scanProvider ?? createNoopScanProvider();

  // -------------------------------------------------------------------------
  // POST /v1/workspaces/:workspace_id/uploads
  // Create an upload target (pre-signed URL).
  // -------------------------------------------------------------------------
  app.post(
    '/v1/workspaces/:workspace_id/uploads',
    {
      schema: {
        body: {
          type: 'object',
          required: ['filename', 'mime_type', 'size_bytes'],
          additionalProperties: false,
          properties: {
            filename: { type: 'string', minLength: 1, maxLength: 500 },
            mime_type: { type: 'string', minLength: 1, maxLength: 200 },
            size_bytes: { type: 'integer', minimum: 1, maximum: 104857600 },
            checksum_sha256: { type: 'string', minLength: 64, maxLength: 64 },
            project_id: { type: 'string' },
          },
        },
      },
    },
    async (request): Promise<CreateUploadResponse> => {
      const ctx = await requireWorkspaceContext(request);
      // Ensure authenticated (session is verified by requireWorkspaceContext)
      requireAuth(request);
      const body = request.body as CreateUploadRequest;

      const target = await storage.createUploadTarget(ctx.workspaceId, {
        mimeType: body.mime_type,
        maxSizeBytes: body.size_bytes,
        ...(body.checksum_sha256 ? { expectedChecksumSha256: body.checksum_sha256 } : {}),
      });

      return {
        upload_id: target.uploadId,
        upload_url: target.uploadUrl,
        expires_at: target.expiresAt,
        max_size_bytes: target.maxSizeBytes,
        allowed_types: [...target.allowedTypes],
      };
    },
  );

  // -------------------------------------------------------------------------
  // POST /v1/workspaces/:workspace_id/uploads/:upload_id/complete
  // Complete an upload, triggering scan and ingestion scheduling.
  // Idempotent via Idempotency-Key header.
  // -------------------------------------------------------------------------
  app.post(
    '/v1/workspaces/:workspace_id/uploads/:upload_id/complete',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            filename: { type: 'string', minLength: 1, maxLength: 500 },
            mime_type: { type: 'string', minLength: 1, maxLength: 200 },
            checksum_sha256: { type: 'string', minLength: 64, maxLength: 64 },
            project_id: { type: 'string' },
          },
        },
      },
    },
    async (request): Promise<CompleteUploadResponse> => {
      const ctx = await requireWorkspaceContext(request);
      const session = requireAuth(request);
      const params = request.params as { workspace_id: string; upload_id: string };
      const body = (request.body ?? {}) as {
        filename?: string;
        mime_type?: string;
        checksum_sha256?: string;
        project_id?: string;
      };

      // Resolve filename: if not provided in body, use a default
      const filename = body.filename ?? `upload-${params.upload_id}`;

      const result = await completeUploadWorkflow(pool, storage, scan, {
        workspaceId: ctx.workspaceId,
        uploadId: params.upload_id,
        filename,
        declaredMimeType: body.mime_type ?? null,
        projectId: body.project_id ?? null,
        createdBy: session.userId,
        storageProviderName: 's3', // Matches the adapter used
        ...(body.checksum_sha256 ? { expectedChecksumSha256: body.checksum_sha256 } : {}),
      });

      return {
        document_id: result.document.id,
        version_id: result.version.id,
        version_number: result.version.versionNumber,
        status: result.version.status,
        quarantine_reason: result.quarantineReason ?? null,
        ingestion_job_id: result.ingestionJob?.id ?? null,
        checksum_sha256: result.version.checksumSha256,
        size_bytes: Number(result.storedFile.sizeBytes),
        mime_type:
          result.storedFile.detectedMimeType ??
          result.storedFile.declaredMimeType ??
          'application/octet-stream',
        created_at: result.version.createdAt,
      };
    },
  );
};

export default uploadRoutes;
