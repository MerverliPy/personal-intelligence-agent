// ---------------------------------------------------------------------------
// Deterministic citation verifier — no model calls (P3-T07)
// ---------------------------------------------------------------------------
// Per FR-CIT-002: The citation verifier MUST confirm the cited source was in
// the generation evidence set.
// Per FR-CIT-003: The verifier MUST reject locators that exceed source
// boundaries or reference superseded/deleted content.
// Per FR-CIT-005: Unsupported claims SHOULD be removed, qualified, or marked
// as inference before final presentation.
//
// Critical deterministic checks do not rely on another model. All validation
// is performed via DB queries and in-memory evidence-map lookups.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import type {
  VerifiableCitation,
  CitationVerification,
  VerificationResult,
  VerificationStatus,
  VerificationReasonCode,
  VerifierInput,
} from './types.js';

// ---------------------------------------------------------------------------
// DB row shapes for internal queries
// ---------------------------------------------------------------------------

type DbChunkRow = {
  id: string;
  workspace_id: string;
  document_id: string;
  document_version_id: string;
  ordinal: number;
  content_hash: string;
  locator: Record<string, unknown>;
};

type DbVersionRow = {
  id: string;
  workspace_id: string;
  document_id: string;
  status: string;
  is_current: boolean;
  extraction_metadata: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getChunkRow(
  pool: Pool,
  chunkId: string,
): Promise<DbChunkRow | null> {
  const result = await pool.query<DbChunkRow>(
    `SELECT id, workspace_id, document_id, document_version_id, ordinal, content_hash, locator
     FROM document_chunks
     WHERE id = $1`,
    [chunkId],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0]!;
}

async function getVersionRow(
  pool: Pool,
  versionId: string,
): Promise<DbVersionRow | null> {
  const result = await pool.query<DbVersionRow>(
    `SELECT id, workspace_id, document_id, status, is_current, extraction_metadata
     FROM document_versions
     WHERE id = $1 AND deleted_at IS NULL`,
    [versionId],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0]!;
}

// ---------------------------------------------------------------------------
// Per-citation check functions
// ---------------------------------------------------------------------------

/**
 * Checks whether the citation's chunk ID appears in the evidence set used
 * during generation. This is a fast in-memory lookup (no DB call).
 */
function checkEvidenceSet(
  citation: VerifiableCitation,
  evidenceMap: ReadonlyMap<string, unknown>,
): false | { status: VerificationStatus; reasonCode: VerificationReasonCode; reason: string } {
  if (!evidenceMap.has(citation.chunkId)) {
    return {
      status: 'INVALID_EVIDENCE_MISSING',
      reasonCode: 'CITATION_NOT_IN_EVIDENCE_SET',
      reason: `Chunk ${citation.chunkId} was not in the generation evidence set`,
    };
  }
  return false; // OK
}

/**
 * Checks chunk existence and workspace alignment.
 */
function checkChunk(
  citation: VerifiableCitation,
  chunkRow: DbChunkRow | null,
  workspaceId: string,
): false | { status: VerificationStatus; reasonCode: VerificationReasonCode; reason: string } {
  if (!chunkRow) {
    return {
      status: 'INVALID_CHUNK_MISSING',
      reasonCode: 'CHUNK_NOT_FOUND',
      reason: `Chunk ${citation.chunkId} not found in document_chunks`,
    };
  }

  if (chunkRow.workspace_id !== workspaceId) {
    return {
      status: 'INVALID_CROSS_WORKSPACE',
      reasonCode: 'CHUNK_WRONG_WORKSPACE',
      reason: `Chunk ${citation.chunkId} belongs to workspace ${chunkRow.workspace_id}, not ${workspaceId}`,
    };
  }

  // Verify the chunk's document_version_id matches what the citation claims
  if (chunkRow.document_version_id !== citation.documentVersionId) {
    return {
      status: 'INVALID_CHUNK_MISSING',
      reasonCode: 'CHUNK_VERSION_MISMATCH',
      reason: `Chunk ${citation.chunkId} is associated with document version ${chunkRow.document_version_id}, not ${citation.documentVersionId}`,
    };
  }

  return false; // OK
}

/**
 * Checks that the document version is lifecycle-valid for citation.
 *
 * Only READY versions are valid for citation. SUPERSEDED, DELETED, FAILED,
 * and other non-READY statuses are rejected.
 */
function checkVersion(
  citation: VerifiableCitation,
  versionRow: DbVersionRow | null,
): false | { status: VerificationStatus; reasonCode: VerificationReasonCode; reason: string } {
  if (!versionRow) {
    return {
      status: 'INVALID_VERSION_STALE',
      reasonCode: 'VERSION_NOT_FOUND',
      reason: `Document version ${citation.documentVersionId} not found or has been deleted`,
    };
  }

  switch (versionRow.status) {
    case 'READY':
      // Only acceptable status for citation
      return false; // OK

    case 'SUPERSEDED':
      return {
        status: 'INVALID_VERSION_STALE',
        reasonCode: 'VERSION_SUPERSEDED',
        reason: `Document version ${citation.documentVersionId} has been superseded`,
      };

    case 'DELETED':
      return {
        status: 'INVALID_VERSION_STALE',
        reasonCode: 'VERSION_DELETED',
        reason: `Document version ${citation.documentVersionId} has been deleted`,
      };

    case 'FAILED':
      return {
        status: 'INVALID_VERSION_STALE',
        reasonCode: 'VERSION_FAILED',
        reason: `Document version ${citation.documentVersionId} is in FAILED state`,
      };

    default:
      return {
        status: 'INVALID_VERSION_STALE',
        reasonCode: 'VERSION_NOT_READY',
        reason: `Document version ${citation.documentVersionId} is ${versionRow.status}, not READY`,
      };
  }
}

/**
 * Checks that the citation's source locator is within document boundaries.
 *
 * Uses extraction_metadata from the document version. When metadata is
 * unavailable, the check is skipped (no false-positive rejection).
 */
function checkLocatorBounds(
  citation: VerifiableCitation,
  versionRow: DbVersionRow,
): false | { status: VerificationStatus; reasonCode: VerificationReasonCode; reason: string } {
  const locator = citation.sourceLocator;
  const meta = versionRow.extraction_metadata;

  // If no locator data, skip boundary check (no false positives)
  if (!locator || typeof locator !== 'object' || Object.keys(locator).length === 0) {
    return false;
  }

  // If no extraction metadata, we cannot check bounds
  if (!meta || typeof meta !== 'object') {
    return false;
  }

  // --- Page boundary check ---
  const page = extractLocatorPage(locator);
  const pageCount = typeof meta['pageCount'] === 'number' ? meta['pageCount'] : undefined;
  if (page !== null && pageCount !== undefined && page > pageCount) {
    return {
      status: 'INVALID_LOCATOR_OUT_OF_BOUNDS',
      reasonCode: 'LOCATOR_PAGE_EXCEEDS_PAGE_COUNT',
      reason: `Locator page ${page} exceeds document page count ${pageCount}`,
    };
  }

  // --- Character offset boundary check ---
  const charCount = typeof meta['characterCount'] === 'number' ? meta['characterCount'] : undefined;
  if (charCount !== undefined) {
    const startOffsetVal = locator['startOffset'];
    const endOffsetVal = locator['endOffset'];
    const startOffset = typeof startOffsetVal === 'number' ? startOffsetVal : null;
    const endOffset = typeof endOffsetVal === 'number' ? endOffsetVal : null;

    if (startOffset !== null && startOffset > charCount) {
      return {
        status: 'INVALID_LOCATOR_OUT_OF_BOUNDS',
        reasonCode: 'LOCATOR_OFFSET_EXCEEDS_CHARACTER_COUNT',
        reason: `Locator startOffset ${startOffset} exceeds document characterCount ${charCount}`,
      };
    }

    if (endOffset !== null && endOffset > charCount) {
      return {
        status: 'INVALID_LOCATOR_OUT_OF_BOUNDS',
        reasonCode: 'LOCATOR_OFFSET_EXCEEDS_CHARACTER_COUNT',
        reason: `Locator endOffset ${endOffset} exceeds document characterCount ${charCount}`,
      };
    }
  }

  return false; // OK or can't check
}

/**
 * Extracts a page number from the locator, handling various shapes.
 */
function extractLocatorPage(locator: Record<string, unknown>): number | null {
  // Direct page field
  const directPage = locator['page'];
  if (typeof directPage === 'number') return directPage;

  // Locator type shape from parsing: { type: 'page', ordinal: N }
  const locType = locator['type'];
  const locOrdinal = locator['ordinal'];
  if (locType === 'page' && typeof locOrdinal === 'number') return locOrdinal;

  // Nested locator shape from chunks: { locator: { type: 'page', ordinal: N } }
  const nestedLocator = locator['locator'];
  if (
    nestedLocator !== undefined &&
    typeof nestedLocator === 'object' &&
    !Array.isArray(nestedLocator)
  ) {
    const inner = nestedLocator as Record<string, unknown>;
    const innerType = inner['type'];
    const innerOrdinal = inner['ordinal'];
    if (innerType === 'page' && typeof innerOrdinal === 'number') return innerOrdinal;

    const innerPage = inner['page'];
    if (typeof innerPage === 'number') return innerPage;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main verifier function
// ---------------------------------------------------------------------------

/**
 * Verifies a batch of citations before a run is marked COMPLETED.
 *
 * For each citation, performs deterministic checks (no model calls):
 * 1. Confirms the chunk was in the generation evidence set.
 * 2. Queries document_chunks for chunk existence and workspace alignment.
 * 3. Queries document_versions for lifecycle status (READY only).
 * 4. Validates locator against document boundaries (page count, character count).
 *
 * @param pool   Database pool for document_chunk and document_version queries.
 * @param input  Citations, workspace, model run, and evidence map.
 * @returns      Aggregate verification result with per-citation statuses.
 */
export async function verifyCitations(
  pool: Pool,
  input: VerifierInput,
): Promise<VerificationResult> {
  const results: CitationVerification[] = [];

  for (const citation of input.citations) {
    // 1. Evidence-set check (in-memory, no DB)
    const evidenceFailure = checkEvidenceSet(citation, input.evidenceMap);
    if (evidenceFailure) {
      results.push({
        citationId: citation.id,
        chunkId: citation.chunkId,
        documentVersionId: citation.documentVersionId,
        status: evidenceFailure.status,
        reason: evidenceFailure.reason,
        reasonCode: evidenceFailure.reasonCode,
      });
      continue;
    }

    // 2. Chunk existence and workspace check (DB)
    const chunkRow = await getChunkRow(pool, citation.chunkId);
    const chunkFailure = checkChunk(citation, chunkRow, input.workspaceId);
    if (chunkFailure) {
      results.push({
        citationId: citation.id,
        chunkId: citation.chunkId,
        documentVersionId: citation.documentVersionId,
        status: chunkFailure.status,
        reason: chunkFailure.reason,
        reasonCode: chunkFailure.reasonCode,
      });
      continue;
    }

    // 3. Version lifecycle check (DB)
    const versionRow = await getVersionRow(pool, citation.documentVersionId);
    const versionFailure = checkVersion(citation, versionRow);
    if (versionFailure) {
      results.push({
        citationId: citation.id,
        chunkId: citation.chunkId,
        documentVersionId: citation.documentVersionId,
        status: versionFailure.status,
        reason: versionFailure.reason,
        reasonCode: versionFailure.reasonCode,
      });
      continue;
    }

    // 4. Locator boundary check
    const locatorFailure = checkLocatorBounds(citation, versionRow!);
    if (locatorFailure) {
      results.push({
        citationId: citation.id,
        chunkId: citation.chunkId,
        documentVersionId: citation.documentVersionId,
        status: locatorFailure.status,
        reason: locatorFailure.reason,
        reasonCode: locatorFailure.reasonCode,
      });
      continue;
    }

    // All checks passed
    results.push({
      citationId: citation.id,
      chunkId: citation.chunkId,
      documentVersionId: citation.documentVersionId,
      status: 'VALID',
    });
  }

  const validCount = results.filter((r) => r.status === 'VALID').length;
  const invalidCount = results.length - validCount;

  return {
    modelRunId: input.modelRunId,
    allValid: invalidCount === 0 && results.length > 0,
    totalCitations: results.length,
    validCount,
    invalidCount,
    results,
  };
}
