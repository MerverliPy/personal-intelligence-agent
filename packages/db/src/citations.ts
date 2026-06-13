// ---------------------------------------------------------------------------
// Citation domain types and repository
// ---------------------------------------------------------------------------
// Per P3-T06: citations are immutable after creation. Only INSERT and SELECT
// operations are exposed; verification_status is set to 'PENDING' on insert
// and owned by P3-T07.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';

/**
 * A persisted citation row.
 */
export interface CitationRow {
  id: string;
  workspaceId: string;
  modelRunId: string;
  assistantMessageId: string;
  chunkId: string;
  documentVersionId: string;
  claimStart: number | null;
  claimEnd: number | null;
  sourceLocator: Record<string, unknown>;
  verificationStatus: string;
  createdAt: string;
}

/**
 * Input for creating a new citation.
 */
export interface CreateCitationInput {
  workspaceId: string;
  modelRunId: string;
  assistantMessageId: string;
  chunkId: string;
  documentVersionId: string;
  sourceLocator: Record<string, unknown>;
  claimStart: number | null;
  claimEnd: number | null;
  claimText: string;
}

/**
 * Creates a citation scoped to the given workspace.
 * Verification status is always set to 'PENDING' on insert.
 */
export async function createCitation(
  pool: Pool,
  input: CreateCitationInput,
): Promise<CitationRow> {
  const result = await pool.query<DbCitation>(
    `INSERT INTO citations
       (workspace_id, model_run_id, assistant_message_id, chunk_id,
        document_version_id, claim_start, claim_end, source_locator)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.workspaceId,
      input.modelRunId,
      input.assistantMessageId,
      input.chunkId,
      input.documentVersionId,
      input.claimStart,
      input.claimEnd,
      JSON.stringify(input.sourceLocator),
    ],
  );
  return toCitationRow(result.rows[0]!);
}

/**
 * Retrieves all citations for a given assistant message, scoped to workspace.
 */
export async function getCitationsForMessage(
  pool: Pool,
  workspaceId: string,
  messageId: string,
): Promise<CitationRow[]> {
  const result = await pool.query<DbCitation>(
    `SELECT c.* FROM citations c
     WHERE c.workspace_id = $1
       AND c.assistant_message_id = $2
     ORDER BY c.claim_start ASC NULLS LAST, c.created_at ASC`,
    [workspaceId, messageId],
  );
  return result.rows.map(toCitationRow);
}

/**
 * Retrieves all citations for a given model run, scoped to workspace.
 */
export async function getCitationsForModelRun(
  pool: Pool,
  workspaceId: string,
  modelRunId: string,
): Promise<CitationRow[]> {
  const result = await pool.query<DbCitation>(
    `SELECT c.* FROM citations c
     WHERE c.workspace_id = $1
       AND c.model_run_id = $2
     ORDER BY c.claim_start ASC NULLS LAST, c.created_at ASC`,
    [workspaceId, modelRunId],
  );
  return result.rows.map(toCitationRow);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type DbCitation = {
  id: string;
  workspace_id: string;
  model_run_id: string;
  assistant_message_id: string;
  chunk_id: string;
  document_version_id: string;
  claim_start: number | null;
  claim_end: number | null;
  source_locator: Record<string, unknown>;
  verification_status: string;
  created_at: string;
};

function toCitationRow(row: DbCitation): CitationRow {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    modelRunId: row.model_run_id,
    assistantMessageId: row.assistant_message_id,
    chunkId: row.chunk_id,
    documentVersionId: row.document_version_id,
    claimStart: row.claim_start,
    claimEnd: row.claim_end,
    sourceLocator: row.source_locator,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
  };
}
