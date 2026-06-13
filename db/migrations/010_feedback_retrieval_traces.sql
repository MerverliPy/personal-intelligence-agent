-- Migration 010: Feedback retrieval trace linkage
--
-- Closes the gap between G-004 / J-005 (which require feedback to be
-- linked to the retrieval trace) and migration 009_feedback.sql (which
-- only links feedback to messages and model runs).
--
-- This migration is additive: it does not modify the existing feedback
-- table, its enum, or any RLS policies. Existing rows are unaffected.
--
-- A feedback row may reference zero or more retrieval traces that
-- contributed evidence to the model's answer. Traces are not FK-linked
-- to model_run_retrieval_traces to avoid coupling; provenance is
-- validated at the application layer (the trace must belong to a
-- model_run linked to the same message).
--
-- Cascade behaviour:
--   - ON DELETE CASCADE from feedback: removing a feedback row removes
--     its trace links.
--   - ON DELETE CASCADE from workspaces: workspace deletion removes all
--     feedback and trace links (matches the existing feedback RLS).
--   - No FK to retrieval_traces: traces may be retained even if the
--     feedback is removed (workspace-level retention policy).

CREATE TABLE feedback_retrieval_traces (
  feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  retrieval_trace_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, retrieval_trace_id)
);

CREATE INDEX feedback_retrieval_traces_workspace_idx
  ON feedback_retrieval_traces(workspace_id, feedback_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security (defense-in-depth, mirrors feedback_rls)
-- ---------------------------------------------------------------------------

ALTER TABLE feedback_retrieval_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_retrieval_traces_rls ON feedback_retrieval_traces
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );
