-- Migration 008: Citations table
--
-- Creates the citation persistence layer for P3 conversational grounding:
--   citations (claim-to-chunk evidence links with version and locator)
--
-- Per FR-CIT-001: Each citation MUST link a generated claim to one or more
-- retrieved chunk spans. FR-CIT-002: The citation verifier MUST confirm the
-- cited source was in the generation evidence set.
--
-- Per docs/03_DATA_MODEL.md#9, citations are scoped to workspaces with RLS.
-- verification_status defaults to 'PENDING'; P3-T07 owns verification transitions.

-- ---------------------------------------------------------------------------
-- citations
-- ---------------------------------------------------------------------------

CREATE TABLE citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  model_run_id uuid NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  assistant_message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id),
  document_version_id uuid NOT NULL REFERENCES document_versions(id),
  claim_start integer,
  claim_end integer,
  source_locator jsonb NOT NULL,
  verification_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX citations_message_idx ON citations(assistant_message_id);
CREATE INDEX citations_model_run_idx ON citations(model_run_id);

COMMENT ON COLUMN citations.verification_status IS
  'P3-T06 inserts with PENDING; P3-T07 owns the verification state machine.';
COMMENT ON COLUMN citations.claim_start IS
  'Character offset of the cited claim in the assistant message content (0-based).';
COMMENT ON COLUMN citations.claim_end IS
  'Character offset of the cited claim end (exclusive).';

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY citations_rls ON citations
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );
