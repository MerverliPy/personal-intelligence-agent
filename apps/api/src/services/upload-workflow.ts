// ---------------------------------------------------------------------------
// Upload completion workflow (application service)
// ---------------------------------------------------------------------------
// Coordinates the end-to-end flow from a completed object upload through
// scan, quarantine decision, and ingestion scheduling.
//
// Lives in the API layer rather than @pia/knowledge because it orchestrates
// across storage, scanning, knowledge persistence, and job outbox — all of
// which are separate bounded context packages.
//
// Satisfies FR-ING-002 and NFR-SEC-004 (file-processing controls).
// ---------------------------------------------------------------------------

import type { Pool, PoolClient } from 'pg';
import type { StorageProvider, UploadCompletion } from '@pia/storage';
import { publishOutboxEvent } from '@pia/jobs';
import {
  createStoredFile,
  getStoredFileByKey,
  updateStoredFileScanResult,
  createDocument,
  createDocumentVersion,
  transitionDocumentVersionStatus,
  createIngestionJob,
  type ScanProvider,
  type StoredFile,
  type Document,
  type DocumentVersion,
  type IngestionJob,
} from '@pia/knowledge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Adapts a PoolClient to satisfy the Pool type expected by repository
 * functions. Both share identical query() signatures at runtime; only
 * TypeScript's structural typing with exactOptionalPropertyTypes prevents
 * direct assignment.
 *
 * This is a controlled escape hatch — once pg publishes a shared
 * Queryable interface this can be removed.
 */
function asPool(client: PoolClient): Pool {
  return client as unknown as Pool;
}

/**
 * Maps a scan status to a human-readable quarantine reason.
 */
function quarantineReasonForStatus(scanStatus: string): string {
  const reasons: Record<string, string> = {
    INFECTED: 'Malware detected. File has been quarantined for security review.',
    PENDING: 'Security scan is still in progress. File has been quarantined pending completion.',
    ERROR: 'Security scan encountered an error. File has been quarantined for curator review.',
  };
  return reasons[scanStatus] ?? `Scan status "${scanStatus}" prevented ingestion.`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input for the upload completion workflow. */
export interface CompleteUploadInput {
  /** The workspace that owns this upload. */
  readonly workspaceId: string;
  /** The upload ID returned by createUploadTarget. */
  readonly uploadId: string;
  /** Human-readable original filename. */
  readonly filename: string;
  /** MIME type declared by the client at upload initiation. */
  readonly declaredMimeType: string | null;
  /** Optional project to associate the document with. */
  readonly projectId?: string | null;
  /** The authenticated user performing the action. */
  readonly createdBy: string;
  /** Storage provider identifier (e.g. "local", "s3"). */
  readonly storageProviderName: string;
  /** SHA-256 checksum the client committed to (optional). */
  readonly expectedChecksumSha256?: string;
  /**
   * Allowed MIME types for the workspace.
   * Defaults to the built-in safe list when omitted.
   */
  readonly allowedMimeTypes?: readonly string[];
  /** Pipeline version to record on the ingestion job. */
  readonly pipelineVersion?: string;
}

/** Result of the upload completion workflow. */
export interface CompleteUploadResult {
  /** The created document. */
  readonly document: Document;
  /** The created document version (status is QUARANTINED or INGESTING). */
  readonly version: DocumentVersion;
  /** The created stored file record. */
  readonly storedFile: StoredFile;
  /** Human-readable reason when the version was quarantined. */
  readonly quarantineReason?: string;
  /** The ingestion job when the version proceeds to ingestion. */
  readonly ingestionJob?: IngestionJob;
}

// ---------------------------------------------------------------------------
// Quarantine decision
// ---------------------------------------------------------------------------

interface QuarantineDecision {
  readonly quarantine: boolean;
  readonly reason?: string;
}

function decideQuarantine(
  scanStatus: string,
  detectedMimeType: string | null,
  allowedMimeTypes: readonly string[],
  sizeBytes: number,
  maxSizeBytes: number,
): QuarantineDecision {
  // Size check
  if (sizeBytes > maxSizeBytes) {
    return {
      quarantine: true,
      reason: `File size ${sizeBytes} exceeds maximum ${maxSizeBytes} bytes.`,
    };
  }

  // Scan check
  if (scanStatus !== 'CLEAN') {
    return {
      quarantine: true,
      reason: quarantineReasonForStatus(scanStatus),
    };
  }

  // MIME type check
  if (!detectedMimeType || !allowedMimeTypes.includes(detectedMimeType)) {
    const safeType = detectedMimeType ?? 'unknown';
    return {
      quarantine: true,
      reason: `File type "${safeType}" is not in the workspace allowed types. File has been quarantined.`,
    };
  }

  return { quarantine: false };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

const DEFAULT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'text/html',
] as const;

const DEFAULT_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Completes an upload after the client confirms the object is stored.
 *
 * This is the core domain operation that:
 * 1. Verifies the object exists in storage (checksum, size, MIME)
 * 2. Creates knowledge records (StoredFile, Document, DocumentVersion)
 * 3. Runs content scanning (MIME detection, malware check)
 * 4. Decides quarantine vs ingestion based on scan results
 * 5. Publishes outbox events for downstream workers
 *
 * The workflow is **idempotent**: completing the same upload a second time
 * returns the existing result rather than creating duplicate records.
 */
export async function completeUploadWorkflow(
  pool: Pool,
  storage: StorageProvider,
  scan: ScanProvider,
  input: CompleteUploadInput,
): Promise<CompleteUploadResult> {
  // -----------------------------------------------------------------------
  // 1. Verify the object exists in storage (outside transaction).
  // -----------------------------------------------------------------------
  let completion: UploadCompletion;
  try {
    completion = await storage.completeUpload(input.workspaceId, input.uploadId, {
      maxSizeBytes: DEFAULT_MAX_SIZE_BYTES,
      ...(input.expectedChecksumSha256
        ? { expectedChecksumSha256: input.expectedChecksumSha256 }
        : {}),
    });
  } catch (err) {
    throw new Error(
      `Upload verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }

  // -----------------------------------------------------------------------
  // 2. Database operations within a transaction.
  // -----------------------------------------------------------------------
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // -------------------------------------------------------------------
    // 2a. Idempotency check: has this object key already been stored?
    // -------------------------------------------------------------------
    const existing = await getStoredFileByKey(
      asPool(client),
      input.workspaceId,
      input.storageProviderName,
      completion.objectKey,
    );
    if (existing) {
      // Verify workspace ownership for defense-in-depth
      if (existing.workspaceId !== input.workspaceId) {
        throw new Error('Stored file does not belong to the specified workspace.');
      }

      // Find the existing document version for this stored file
      const versionResult = await client.query<{
        id: string;
        workspace_id: string;
        document_id: string;
        stored_file_id: string;
        version_number: number;
        status: string;
        is_current: boolean;
        checksum_sha256: string;
        pipeline_version: string | null;
        extraction_metadata: Record<string, unknown>;
        failure_code: string | null;
        failure_safe_message: string | null;
        ready_at: string | null;
        superseded_at: string | null;
        deleted_at: string | null;
        created_by: string;
        created_at: string;
      }>(
        `SELECT * FROM document_versions
         WHERE workspace_id = $1 AND stored_file_id = $2 AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [input.workspaceId, existing.id],
      );

      if (versionResult.rows.length > 0) {
        const vRow = versionResult.rows[0]!;

        const docResult = await client.query<{
          id: string;
          workspace_id: string;
          project_id: string | null;
          source_id: string | null;
          title: string;
          sensitivity: string;
          current_version_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        }>(`SELECT * FROM documents WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL`, [
          input.workspaceId,
          vRow.document_id,
        ]);

        if (docResult.rows.length === 0) {
          throw new Error('Document not found for existing version.');
        }
        const dRow = docResult.rows[0]!;

        // Fetch any existing ingestion job
        const jobResult = await client.query<{
          id: string;
          workspace_id: string;
          document_version_id: string;
          idempotency_key: string;
          pipeline_version: string;
          status: string;
          stage: string | null;
          attempt: number;
          max_attempts: number;
          next_attempt_at: string | null;
          error_code: string | null;
          error_safe_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        }>(
          `SELECT * FROM ingestion_jobs
           WHERE workspace_id = $1 AND document_version_id = $2
           ORDER BY created_at DESC LIMIT 1`,
          [input.workspaceId, vRow.id],
        );

        await client.query('COMMIT');

        const existingDoc: Document = {
          id: dRow.id,
          workspaceId: dRow.workspace_id,
          projectId: dRow.project_id,
          sourceId: dRow.source_id,
          title: dRow.title,
          sensitivity: dRow.sensitivity as Document['sensitivity'],
          currentVersionId: dRow.current_version_id,
          createdBy: dRow.created_by,
          createdAt: dRow.created_at,
          updatedAt: dRow.updated_at,
          deletedAt: dRow.deleted_at,
        };

        const existingVersion: DocumentVersion = {
          id: vRow.id,
          workspaceId: vRow.workspace_id,
          documentId: vRow.document_id,
          storedFileId: vRow.stored_file_id,
          versionNumber: vRow.version_number,
          status: vRow.status as DocumentVersion['status'],
          isCurrent: vRow.is_current,
          checksumSha256: vRow.checksum_sha256,
          pipelineVersion: vRow.pipeline_version,
          extractionMetadata: vRow.extraction_metadata,
          failureCode: vRow.failure_code,
          failureSafeMessage: vRow.failure_safe_message,
          readyAt: vRow.ready_at,
          supersededAt: vRow.superseded_at,
          deletedAt: vRow.deleted_at,
          createdBy: vRow.created_by,
          createdAt: vRow.created_at,
        };

        let existingJob: IngestionJob | undefined;
        if (jobResult.rows.length > 0) {
          const jRow = jobResult.rows[0]!;
          existingJob = {
            id: jRow.id,
            workspaceId: jRow.workspace_id,
            documentVersionId: jRow.document_version_id,
            idempotencyKey: jRow.idempotency_key,
            pipelineVersion: jRow.pipeline_version,
            status: jRow.status as IngestionJob['status'],
            stage: jRow.stage,
            attempt: jRow.attempt,
            maxAttempts: jRow.max_attempts,
            nextAttemptAt: jRow.next_attempt_at,
            errorCode: jRow.error_code,
            errorSafeMessage: jRow.error_safe_message,
            startedAt: jRow.started_at,
            completedAt: jRow.completed_at,
            createdAt: jRow.created_at,
            updatedAt: jRow.updated_at,
          };
        }

        const qReason =
          existingVersion.status === 'QUARANTINED'
            ? 'Previously quarantined. See scan metadata for details.'
            : undefined;

        return {
          document: existingDoc,
          version: existingVersion,
          storedFile: existing,
          ...(qReason ? { quarantineReason: qReason } : {}),
          ...(existingJob ? { ingestionJob: existingJob } : {}),
        };
      }
    }

    // -------------------------------------------------------------------
    // 2b. Create the stored file record.
    // -------------------------------------------------------------------
    const storedFile = await createStoredFile(asPool(client), {
      workspaceId: input.workspaceId,
      storageProvider: input.storageProviderName,
      objectKey: completion.objectKey,
      originalFilename: input.filename,
      declaredMimeType: input.declaredMimeType,
      sizeBytes: completion.size,
      checksumSha256: completion.checksumSha256,
      createdBy: input.createdBy,
    });

    // -------------------------------------------------------------------
    // 2c. Run content scanning.
    // -------------------------------------------------------------------
    const scanResult = await scan.scan({
      workspaceId: input.workspaceId,
      objectKey: completion.objectKey,
      sizeBytes: completion.size,
      checksumSha256: completion.checksumSha256,
      storageMimeType: completion.mimeType,
      filename: input.filename,
      declaredMimeType: input.declaredMimeType,
    });

    // Update scan results on the stored file record
    const scannedFile = await updateStoredFileScanResult(
      asPool(client),
      input.workspaceId,
      storedFile.id,
      {
        scanStatus: scanResult.status,
        detectedMimeType: scanResult.detectedMimeType,
        scanMetadata: scanResult.metadata,
      },
    );

    // -------------------------------------------------------------------
    // 2d. Create document and document version.
    // -------------------------------------------------------------------
    const doc = await createDocument(asPool(client), {
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      title: input.filename,
      sensitivity: 'INTERNAL',
      createdBy: input.createdBy,
    });

    const version = await createDocumentVersion(asPool(client), {
      workspaceId: input.workspaceId,
      documentId: doc.id,
      storedFileId: scannedFile.id,
      checksumSha256: completion.checksumSha256,
      pipelineVersion: input.pipelineVersion ?? null,
      createdBy: input.createdBy,
    });

    // Transition: PENDING_UPLOAD -> UPLOADED
    const uploadedVersion = await transitionDocumentVersionStatus(
      asPool(client),
      input.workspaceId,
      version.id,
      'UPLOADED',
    );

    // -------------------------------------------------------------------
    // 2e. Quarantine decision.
    // -------------------------------------------------------------------
    const allowedTypes = input.allowedMimeTypes ?? [...DEFAULT_ALLOWED_MIME_TYPES];

    const decision = decideQuarantine(
      scanResult.status,
      scanResult.detectedMimeType,
      allowedTypes,
      completion.size,
      DEFAULT_MAX_SIZE_BYTES,
    );

    // -------------------------------------------------------------------
    // 2f. Apply quarantine or proceed to ingestion.
    // -------------------------------------------------------------------
    let finalVersion: DocumentVersion;
    let ingestionJob: IngestionJob | undefined;

    if (decision.quarantine) {
      // Transition: UPLOADED -> QUARANTINED
      finalVersion = await transitionDocumentVersionStatus(
        asPool(client),
        input.workspaceId,
        uploadedVersion.id,
        'QUARANTINED',
      );
    } else {
      // Transition: UPLOADED -> INGESTING
      finalVersion = await transitionDocumentVersionStatus(
        asPool(client),
        input.workspaceId,
        uploadedVersion.id,
        'INGESTING',
      );

      // Create the ingestion job (idempotent via unique constraint)
      const idempotencyKey = `${input.workspaceId}:${input.uploadId}:ingest:v1`;
      ingestionJob = await createIngestionJob(asPool(client), {
        workspaceId: input.workspaceId,
        documentVersionId: finalVersion.id,
        idempotencyKey,
        pipelineVersion: input.pipelineVersion ?? '1.0.0',
      });
    }

    // -------------------------------------------------------------------
    // 2g. Publish outbox events.
    // -------------------------------------------------------------------
    await publishOutboxEvent(client, {
      workspaceId: input.workspaceId,
      aggregateType: 'document',
      aggregateId: doc.id,
      eventType: 'document.upload.completed',
      schemaVersion: 1,
      payload: {
        documentId: doc.id,
        versionId: finalVersion.id,
        storedFileId: scannedFile.id,
        status: finalVersion.status,
        quarantineReason: decision.reason ?? null,
        checksumSha256: completion.checksumSha256,
        sizeBytes: completion.size,
        mimeType: scanResult.detectedMimeType ?? completion.mimeType,
        scanStatus: scanResult.status,
      },
    });

    // If ingestion was triggered, also publish the ingestion.requested event
    if (ingestionJob) {
      await publishOutboxEvent(client, {
        workspaceId: input.workspaceId,
        aggregateType: 'ingestion_job',
        aggregateId: ingestionJob.id,
        eventType: 'document.ingestion.requested',
        schemaVersion: 1,
        payload: {
          ingestionJobId: ingestionJob.id,
          documentVersionId: finalVersion.id,
          documentId: doc.id,
          workspaceId: input.workspaceId,
          pipelineVersion: input.pipelineVersion ?? '1.0.0',
        },
      });
    }

    // -------------------------------------------------------------------
    // 2h. Commit and return.
    // -------------------------------------------------------------------
    await client.query('COMMIT');

    return {
      document: doc,
      version: finalVersion,
      storedFile: scannedFile,
      ...(decision.reason ? { quarantineReason: decision.reason } : {}),
      ...(ingestionJob ? { ingestionJob } : {}),
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
