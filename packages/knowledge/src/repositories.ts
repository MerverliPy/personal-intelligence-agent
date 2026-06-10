import type { Pool } from 'pg';
import type {
  Source,
  CreateSourceInput,
  StoredFile,
  CreateStoredFileInput,
  Document,
  CreateDocumentInput,
  DocumentVersion,
  DocumentVersionStatus,
  CreateDocumentVersionInput,
  IngestionJob,
  IngestionJobStatus,
  CreateIngestionJobInput,
} from './types.js';
import {
  isValidDocumentVersionTransition,
  isValidIngestionJobTransition,
} from './state-machine.js';

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/**
 * Creates a new source record. Returns the created row.
 */
export async function createSource(pool: Pool, input: CreateSourceInput): Promise<Source> {
  const result = await pool.query<{
    id: string;
    workspace_id: string;
    project_id: string | null;
    source_type: string;
    name: string;
    authority_rank: number;
    sensitivity: string;
    external_reference: string | null;
    configuration: Record<string, unknown>;
    status: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }>(
    `INSERT INTO sources (workspace_id, project_id, source_type, name, authority_rank, sensitivity, external_reference, configuration, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.workspaceId,
      input.projectId ?? null,
      input.sourceType,
      input.name,
      input.authorityRank ?? 100,
      input.sensitivity ?? 'INTERNAL',
      input.externalReference ?? null,
      JSON.stringify(input.configuration ?? {}),
      input.createdBy,
    ],
  );
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    sourceType: row.source_type,
    name: row.name,
    authorityRank: row.authority_rank,
    sensitivity: row.sensitivity as Source['sensitivity'],
    externalReference: row.external_reference,
    configuration: row.configuration,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Returns a source by id within a workspace, or null.
 */
export async function getSourceById(
  pool: Pool,
  workspaceId: string,
  sourceId: string,
): Promise<Source | null> {
  const result = await pool.query<{
    id: string;
    workspace_id: string;
    project_id: string | null;
    source_type: string;
    name: string;
    authority_rank: number;
    sensitivity: string;
    external_reference: string | null;
    configuration: Record<string, unknown>;
    status: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }>(`SELECT * FROM sources WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL`, [
    workspaceId,
    sourceId,
  ]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    sourceType: row.source_type,
    name: row.name,
    authorityRank: row.authority_rank,
    sensitivity: row.sensitivity as Source['sensitivity'],
    externalReference: row.external_reference,
    configuration: row.configuration,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Lists sources in a workspace, optionally filtered by project or status.
 */
export async function listSources(
  pool: Pool,
  workspaceId: string,
  opts?: { projectId?: string; status?: string; limit?: number; offset?: number },
): Promise<Source[]> {
  const conditions = ['workspace_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [workspaceId];
  let paramIdx = 2;

  if (opts?.projectId) {
    conditions.push(`project_id = $${paramIdx}`);
    params.push(opts.projectId);
    paramIdx++;
  }
  if (opts?.status) {
    conditions.push(`status = $${paramIdx}`);
    params.push(opts.status);
    paramIdx++;
  }

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const result = await pool.query<{
    id: string;
    workspace_id: string;
    project_id: string | null;
    source_type: string;
    name: string;
    authority_rank: number;
    sensitivity: string;
    external_reference: string | null;
    configuration: Record<string, unknown>;
    status: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }>(
    `SELECT * FROM sources WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );
  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    sourceType: row.source_type,
    name: row.name,
    authorityRank: row.authority_rank,
    sensitivity: row.sensitivity as Source['sensitivity'],
    externalReference: row.external_reference,
    configuration: row.configuration,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
}

/**
 * Soft-deletes a source by setting `deleted_at`.
 */
export async function softDeleteSource(
  pool: Pool,
  workspaceId: string,
  sourceId: string,
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE sources SET deleted_at = now(), updated_at = now()
     WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [workspaceId, sourceId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// StoredFiles
// ---------------------------------------------------------------------------

/**
 * Creates a stored file record. Violates UNIQUE on (storage_provider, object_key)
 * if a duplicate is inserted.
 */
export async function createStoredFile(
  pool: Pool,
  input: CreateStoredFileInput,
): Promise<StoredFile> {
  const result = await pool.query<{
    id: string;
    workspace_id: string;
    storage_provider: string;
    object_key: string;
    original_filename: string;
    declared_mime_type: string | null;
    detected_mime_type: string | null;
    size_bytes: number;
    checksum_sha256: string;
    scan_status: string;
    scan_metadata: Record<string, unknown>;
    created_by: string;
    created_at: string;
    deleted_at: string | null;
  }>(
    `INSERT INTO stored_files (workspace_id, storage_provider, object_key, original_filename, declared_mime_type, size_bytes, checksum_sha256, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.workspaceId,
      input.storageProvider,
      input.objectKey,
      input.originalFilename,
      input.declaredMimeType ?? null,
      input.sizeBytes,
      input.checksumSha256,
      input.createdBy,
    ],
  );
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    storageProvider: row.storage_provider,
    objectKey: row.object_key,
    originalFilename: row.original_filename,
    declaredMimeType: row.declared_mime_type,
    detectedMimeType: row.detected_mime_type,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    scanStatus: row.scan_status,
    scanMetadata: row.scan_metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Returns a stored file by storage provider and object key.
 */
export async function getStoredFileByKey(
  pool: Pool,
  storageProvider: string,
  objectKey: string,
): Promise<StoredFile | null> {
  const result = await pool.query<{
    id: string;
    workspace_id: string;
    storage_provider: string;
    object_key: string;
    original_filename: string;
    declared_mime_type: string | null;
    detected_mime_type: string | null;
    size_bytes: number;
    checksum_sha256: string;
    scan_status: string;
    scan_metadata: Record<string, unknown>;
    created_by: string;
    created_at: string;
    deleted_at: string | null;
  }>(`SELECT * FROM stored_files WHERE storage_provider = $1 AND object_key = $2`, [
    storageProvider,
    objectKey,
  ]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    storageProvider: row.storage_provider,
    objectKey: row.object_key,
    originalFilename: row.original_filename,
    declaredMimeType: row.declared_mime_type,
    detectedMimeType: row.detected_mime_type,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    scanStatus: row.scan_status,
    scanMetadata: row.scan_metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Updates scan results on a stored file record.
 *
 * Called after content scanning to record the detected MIME type and scan
 * disposition. Must be called within a transaction for atomicity.
 */
export async function updateStoredFileScanResult(
  pool: Pool,
  workspaceId: string,
  fileId: string,
  scan: {
    scanStatus: string;
    detectedMimeType: string | null;
    scanMetadata: Record<string, unknown>;
  },
): Promise<StoredFile> {
  const result = await pool.query<{
    id: string;
    workspace_id: string;
    storage_provider: string;
    object_key: string;
    original_filename: string;
    declared_mime_type: string | null;
    detected_mime_type: string | null;
    size_bytes: number;
    checksum_sha256: string;
    scan_status: string;
    scan_metadata: Record<string, unknown>;
    created_by: string;
    created_at: string;
    deleted_at: string | null;
  }>(
    `UPDATE stored_files
     SET scan_status = $3,
         detected_mime_type = $4,
         scan_metadata = $5
     WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [
      workspaceId,
      fileId,
      scan.scanStatus,
      scan.detectedMimeType,
      JSON.stringify(scan.scanMetadata),
    ],
  );
  if (result.rows.length === 0) {
    throw new Error(`Stored file not found: ${fileId}`);
  }
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    storageProvider: row.storage_provider,
    objectKey: row.object_key,
    originalFilename: row.original_filename,
    declaredMimeType: row.declared_mime_type,
    detectedMimeType: row.detected_mime_type,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    scanStatus: row.scan_status,
    scanMetadata: row.scan_metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Returns a stored file by id within a workspace.
 */
export async function getStoredFileById(
  pool: Pool,
  workspaceId: string,
  fileId: string,
): Promise<StoredFile | null> {
  const result = await pool.query<{
    id: string;
    workspace_id: string;
    storage_provider: string;
    object_key: string;
    original_filename: string;
    declared_mime_type: string | null;
    detected_mime_type: string | null;
    size_bytes: number;
    checksum_sha256: string;
    scan_status: string;
    scan_metadata: Record<string, unknown>;
    created_by: string;
    created_at: string;
    deleted_at: string | null;
  }>(`SELECT * FROM stored_files WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL`, [
    workspaceId,
    fileId,
  ]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    storageProvider: row.storage_provider,
    objectKey: row.object_key,
    originalFilename: row.original_filename,
    declaredMimeType: row.declared_mime_type,
    detectedMimeType: row.detected_mime_type,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    scanStatus: row.scan_status,
    scanMetadata: row.scan_metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * Creates a new document record.
 */
export async function createDocument(pool: Pool, input: CreateDocumentInput): Promise<Document> {
  const result = await pool.query<{
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
  }>(
    `INSERT INTO documents (workspace_id, project_id, source_id, title, sensitivity, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.workspaceId,
      input.projectId ?? null,
      input.sourceId ?? null,
      input.title,
      input.sensitivity ?? 'INTERNAL',
      input.createdBy,
    ],
  );
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    sourceId: row.source_id,
    title: row.title,
    sensitivity: row.sensitivity as Document['sensitivity'],
    currentVersionId: row.current_version_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Returns a document by id within a workspace.
 */
export async function getDocumentById(
  pool: Pool,
  workspaceId: string,
  documentId: string,
): Promise<Document | null> {
  const result = await pool.query<{
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
    workspaceId,
    documentId,
  ]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    sourceId: row.source_id,
    title: row.title,
    sensitivity: row.sensitivity as Document['sensitivity'],
    currentVersionId: row.current_version_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Lists documents in a workspace, optionally filtered by project or sensitivity.
 */
export async function listDocuments(
  pool: Pool,
  workspaceId: string,
  opts?: { projectId?: string; limit?: number; offset?: number },
): Promise<Document[]> {
  const conditions = ['workspace_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [workspaceId];
  let paramIdx = 2;

  if (opts?.projectId) {
    conditions.push(`project_id = $${paramIdx}`);
    params.push(opts.projectId);
    paramIdx++;
  }

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const result = await pool.query<{
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
  }>(
    `SELECT * FROM documents WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );
  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    sourceId: row.source_id,
    title: row.title,
    sensitivity: row.sensitivity as Document['sensitivity'],
    currentVersionId: row.current_version_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
}

/**
 * Soft-deletes a document by setting `deleted_at`.
 */
export async function softDeleteDocument(
  pool: Pool,
  workspaceId: string,
  documentId: string,
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE documents SET deleted_at = now(), updated_at = now()
     WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [workspaceId, documentId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// DocumentVersions
// ---------------------------------------------------------------------------

/**
 * Creates a new document version record. Auto-increments the version_number
 * for the given document.
 */
export async function createDocumentVersion(
  pool: Pool,
  input: CreateDocumentVersionInput,
): Promise<DocumentVersion> {
  const result = await pool.query<{
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
    `INSERT INTO document_versions (workspace_id, document_id, stored_file_id, version_number, checksum_sha256, pipeline_version, created_by)
     VALUES ($1, $2, $3, COALESCE((SELECT MAX(version_number) FROM document_versions WHERE document_id = $4), 0) + 1, $5, $6, $7)
     RETURNING *`,
    [
      input.workspaceId,
      input.documentId,
      input.storedFileId,
      input.documentId,
      input.checksumSha256,
      input.pipelineVersion ?? null,
      input.createdBy,
    ],
  );
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    storedFileId: row.stored_file_id,
    versionNumber: row.version_number,
    status: row.status as DocumentVersionStatus,
    isCurrent: row.is_current,
    checksumSha256: row.checksum_sha256,
    pipelineVersion: row.pipeline_version,
    extractionMetadata: row.extraction_metadata,
    failureCode: row.failure_code,
    failureSafeMessage: row.failure_safe_message,
    readyAt: row.ready_at,
    supersededAt: row.superseded_at,
    deletedAt: row.deleted_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Returns a document version by id within a workspace.
 */
export async function getDocumentVersionById(
  pool: Pool,
  workspaceId: string,
  versionId: string,
): Promise<DocumentVersion | null> {
  const result = await pool.query<{
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
  }>(`SELECT * FROM document_versions WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL`, [
    workspaceId,
    versionId,
  ]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    storedFileId: row.stored_file_id,
    versionNumber: row.version_number,
    status: row.status as DocumentVersionStatus,
    isCurrent: row.is_current,
    checksumSha256: row.checksum_sha256,
    pipelineVersion: row.pipeline_version,
    extractionMetadata: row.extraction_metadata,
    failureCode: row.failure_code,
    failureSafeMessage: row.failure_safe_message,
    readyAt: row.ready_at,
    supersededAt: row.superseded_at,
    deletedAt: row.deleted_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Lists all versions for a given document within a workspace.
 */
export async function listVersions(
  pool: Pool,
  workspaceId: string,
  documentId: string,
): Promise<DocumentVersion[]> {
  const result = await pool.query<{
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
     WHERE workspace_id = $1 AND document_id = $2 AND deleted_at IS NULL
     ORDER BY version_number DESC`,
    [workspaceId, documentId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    storedFileId: row.stored_file_id,
    versionNumber: row.version_number,
    status: row.status as DocumentVersionStatus,
    isCurrent: row.is_current,
    checksumSha256: row.checksum_sha256,
    pipelineVersion: row.pipeline_version,
    extractionMetadata: row.extraction_metadata,
    failureCode: row.failure_code,
    failureSafeMessage: row.failure_safe_message,
    readyAt: row.ready_at,
    supersededAt: row.superseded_at,
    deletedAt: row.deleted_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

/**
 * Transitions a document version to a new status with guard checks.
 * Must be called within a transaction for atomicity.
 */
export async function transitionDocumentVersionStatus(
  pool: Pool,
  workspaceId: string,
  versionId: string,
  toStatus: DocumentVersionStatus,
): Promise<DocumentVersion> {
  // Read current status
  const current = await getDocumentVersionById(pool, workspaceId, versionId);
  if (!current) {
    throw new Error(`Document version not found: ${versionId}`);
  }

  // Guard: validate transition
  if (!isValidDocumentVersionTransition(current.status, toStatus)) {
    throw new Error(`Illegal document version state transition: ${current.status} -> ${toStatus}`);
  }

  // Perform the update
  const extras: string[] = [];

  if (toStatus === 'READY') {
    extras.push(`ready_at = now()`);
  }
  if (toStatus === 'SUPERSEDED') {
    extras.push(`superseded_at = now()`);
  }
  if (toStatus === 'FAILED') {
    // failure_code and failure_safe_message set via separate update
  }

  const extraSql = extras.length > 0 ? ', ' + extras.join(', ') : '';

  const result = await pool.query<{
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
    `UPDATE document_versions SET status = $3${extraSql}
     WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [workspaceId, versionId, toStatus],
  );
  if (result.rows.length === 0) {
    throw new Error(`Document version not found after update: ${versionId}`);
  }
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    storedFileId: row.stored_file_id,
    versionNumber: row.version_number,
    status: row.status as DocumentVersionStatus,
    isCurrent: row.is_current,
    checksumSha256: row.checksum_sha256,
    pipelineVersion: row.pipeline_version,
    extractionMetadata: row.extraction_metadata,
    failureCode: row.failure_code,
    failureSafeMessage: row.failure_safe_message,
    readyAt: row.ready_at,
    supersededAt: row.superseded_at,
    deletedAt: row.deleted_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Atomically sets a READY version as the current version for a document,
 * superseding any previous current version. Satisfies FR-ING-009.
 *
 * Must be called within a transaction.
 */
export async function setCurrentVersion(
  pool: Pool,
  workspaceId: string,
  documentId: string,
  versionId: string,
): Promise<void> {
  // Supersede the old current version if one exists
  await pool.query(
    `UPDATE document_versions
     SET is_current = false, superseded_at = now()
     WHERE workspace_id = $1
       AND document_id = $2
       AND is_current = true
       AND status = 'READY'`,
    [workspaceId, documentId],
  );

  // Set the new version as current (only if READY)
  await pool.query(
    `UPDATE document_versions
     SET is_current = true
     WHERE workspace_id = $1 AND id = $2 AND status = 'READY' AND deleted_at IS NULL`,
    [workspaceId, versionId],
  );

  // Update the document's current_version_id pointer
  await pool.query(
    `UPDATE documents
     SET current_version_id = $3, updated_at = now()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, documentId, versionId],
  );
}

// ---------------------------------------------------------------------------
// IngestionJobs
// ---------------------------------------------------------------------------

/**
 * Creates a new ingestion job. Violates UNIQUE on (workspace_id, idempotency_key)
 * if a duplicate is inserted.
 */
export async function createIngestionJob(
  pool: Pool,
  input: CreateIngestionJobInput,
): Promise<IngestionJob> {
  const result = await pool.query<{
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
    `INSERT INTO ingestion_jobs (workspace_id, document_version_id, idempotency_key, pipeline_version)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.workspaceId, input.documentVersionId, input.idempotencyKey, input.pipelineVersion],
  );
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    documentVersionId: row.document_version_id,
    idempotencyKey: row.idempotency_key,
    pipelineVersion: row.pipeline_version,
    status: row.status as IngestionJobStatus,
    stage: row.stage,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    errorCode: row.error_code,
    errorSafeMessage: row.error_safe_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Returns an ingestion job by id within a workspace.
 */
export async function getIngestionJobById(
  pool: Pool,
  workspaceId: string,
  jobId: string,
): Promise<IngestionJob | null> {
  const result = await pool.query<{
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
  }>(`SELECT * FROM ingestion_jobs WHERE workspace_id = $1 AND id = $2`, [workspaceId, jobId]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    documentVersionId: row.document_version_id,
    idempotencyKey: row.idempotency_key,
    pipelineVersion: row.pipeline_version,
    status: row.status as IngestionJobStatus,
    stage: row.stage,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    errorCode: row.error_code,
    errorSafeMessage: row.error_safe_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Transitions an ingestion job to a new status with guard checks.
 */
export async function transitionIngestionJobStatus(
  pool: Pool,
  workspaceId: string,
  jobId: string,
  toStatus: IngestionJobStatus,
): Promise<IngestionJob> {
  const current = await getIngestionJobById(pool, workspaceId, jobId);
  if (!current) {
    throw new Error(`Ingestion job not found: ${jobId}`);
  }

  if (!isValidIngestionJobTransition(current.status, toStatus)) {
    throw new Error(`Illegal ingestion job state transition: ${current.status} -> ${toStatus}`);
  }

  const result = await pool.query<{
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
    `UPDATE ingestion_jobs SET status = $3, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, jobId, toStatus],
  );
  if (result.rows.length === 0) {
    throw new Error(`Ingestion job not found after update: ${jobId}`);
  }
  const row = result.rows[0]!;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    documentVersionId: row.document_version_id,
    idempotencyKey: row.idempotency_key,
    pipelineVersion: row.pipeline_version,
    status: row.status as IngestionJobStatus,
    stage: row.stage,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    errorCode: row.error_code,
    errorSafeMessage: row.error_safe_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lists pending ingestion jobs (QUEUED or RETRY_WAIT) with FOR UPDATE SKIP LOCKED
 * for safe concurrent consumption by workers.
 */
export async function listPendingJobs(pool: Pool, limit?: number): Promise<IngestionJob[]> {
  const result = await pool.query<{
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
     WHERE status IN ('QUEUED', 'RETRY_WAIT')
       AND (next_attempt_at IS NULL OR next_attempt_at <= now())
     ORDER BY created_at
     LIMIT $1
     FOR UPDATE SKIP LOCKED`,
    [limit ?? 10],
  );
  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    documentVersionId: row.document_version_id,
    idempotencyKey: row.idempotency_key,
    pipelineVersion: row.pipeline_version,
    status: row.status as IngestionJobStatus,
    stage: row.stage,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    errorCode: row.error_code,
    errorSafeMessage: row.error_safe_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Updates the stage checkpoint on an ingestion job.
 *
 * Called after each pipeline stage completes so resumption knows where to
 * restart after a worker interruption.
 */
export async function updateIngestionJobStage(
  pool: Pool,
  workspaceId: string,
  jobId: string,
  stage: string,
): Promise<void> {
  await pool.query(
    `UPDATE ingestion_jobs
     SET stage = $3, updated_at = now()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, jobId, stage],
  );
}

/**
 * Records an error on an ingestion job without changing its status.
 *
 * The caller is responsible for the status transition (RETRY_WAIT or
 * FAILED_FINAL). This function only persists the diagnostic metadata.
 */
export async function updateIngestionJobError(
  pool: Pool,
  workspaceId: string,
  jobId: string,
  errorCode: string,
  errorSafeMessage: string,
): Promise<void> {
  await pool.query(
    `UPDATE ingestion_jobs
     SET error_code = $3,
         error_safe_message = $4,
         updated_at = now()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, jobId, errorCode, errorSafeMessage],
  );
}

/**
 * Updates the attempt counter and start timestamp on an ingestion job.
 *
 * Called at the beginning of a processing attempt.
 */
export async function updateIngestionJobAttempt(
  pool: Pool,
  workspaceId: string,
  jobId: string,
  attempt: number,
): Promise<void> {
  await pool.query(
    `UPDATE ingestion_jobs
     SET attempt = $3,
         started_at = coalesce(started_at, now()),
         updated_at = now()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, jobId, attempt],
  );
}
