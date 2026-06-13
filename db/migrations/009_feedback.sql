-- Migration 009: Feedback table
--
-- Creates the feedback persistence layer for P3-T08 conversation feedback:
--   feedback (user sentiment, corrections, and automatic failure classification)
--
-- Per FR-FBK-001: Feedback MUST support positive, negative, incorrect,
-- incomplete, citation issue, style issue, unsafe, and free-text correction
-- categories.
-- Per FR-FBK-002: Feedback MUST reference the exact message and model run.
-- Per FR-FBK-003: Automatic classification is stored as a suggestion with
-- confidence; it does not automatically change production behaviour.
--
-- The feedback_category enum is idempotent (DO $$ ... EXCEPTION pattern).

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE feedback_category AS ENUM (
    'POSITIVE',
    'NEGATIVE',
    'INCORRECT',
    'INCOMPLETE',
    'CITATION_ISSUE',
    'STYLE_ISSUE',
    'UNSAFE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- feedback
-- ---------------------------------------------------------------------------

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  model_run_id uuid REFERENCES model_runs(id) ON DELETE SET NULL,
  submitted_by uuid NOT NULL REFERENCES users(id),
  category feedback_category NOT NULL,
  correction text,
  notes text,
  suggested_failure_class text,
  classification_confidence double precision CHECK (classification_confidence BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feedback_workspace_created_idx ON feedback(workspace_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_rls ON feedback
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );
