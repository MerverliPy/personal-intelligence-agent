-- Migration 007: Conversations, messages, model runs, and retrieval traces
--
-- Creates the persistence layer for P3 conversational features:
--   conversations (workspace/project-scoped with sensitivity classification)
--   messages (immutable user/assistant/system/tool entries)
--   model_runs (provider-neutral generation metadata with state machine)
--   model_run_retrieval_traces (join linking runs to retrieval traces)
--
-- Per docs/03_DATA_MODEL.md#9, conversations carry a sensitivity_class.
-- Messages are append-only (no UPDATE/DELETE paths exposed at the DB level).
-- Model-run status transitions are enforced by application-level state machines.
-- Hidden chain-of-thought is NOT persisted (per context_manifest comment).
--
-- Citations and feedback tables are deferred to P3-T06 and P3-T08 respectively.
-- This migration does NOT create those tables.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE conversation_mode AS ENUM (
    'ASK',
    'RESEARCH',
    'ANALYZE',
    'PLAN',
    'EXECUTE',
    'LEARN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_role AS ENUM (
    'USER',
    'ASSISTANT',
    'SYSTEM_NOTE',
    'TOOL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE model_run_status AS ENUM (
    'CREATED',
    'STREAMING',
    'COMPLETED',
    'CANCELLED',
    'FAILED',
    'INTERRUPTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text,
  mode conversation_mode NOT NULL DEFAULT 'ASK',
  sensitivity sensitivity_class NOT NULL DEFAULT 'INTERNAL',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX conversations_workspace_project_idx
  ON conversations(workspace_id, project_id, updated_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN conversations.sensitivity IS
  'Per docs/03_DATA_MODEL.md#9 — controls provider eligibility, logging, retention, and export.';

-- ---------------------------------------------------------------------------
-- messages (immutable after creation)
-- ---------------------------------------------------------------------------

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role message_role NOT NULL,
  content text NOT NULL,
  content_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_idx
  ON messages(conversation_id, created_at, id);

COMMENT ON TABLE messages IS
  'Append-only; no UPDATE or DELETE paths are exposed. Messages are immutable after creation.';

-- ---------------------------------------------------------------------------
-- model_runs
-- ---------------------------------------------------------------------------

CREATE TABLE model_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_message_id uuid NOT NULL REFERENCES messages(id),
  assistant_message_id uuid REFERENCES messages(id),
  status model_run_status NOT NULL DEFAULT 'CREATED',
  provider text NOT NULL,
  model text NOT NULL,
  model_configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_name text NOT NULL,
  prompt_version text NOT NULL,
  context_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_tokens integer,
  output_tokens integer,
  cost_microunits bigint,
  latency_ms integer,
  error_code text,
  error_safe_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX model_runs_workspace_created_idx
  ON model_runs(workspace_id, created_at DESC);

COMMENT ON COLUMN model_runs.context_manifest IS
  'References and inclusion metadata; do NOT store hidden chain-of-thought content.';

-- ---------------------------------------------------------------------------
-- model_run_retrieval_traces (join table)
-- ---------------------------------------------------------------------------

CREATE TABLE model_run_retrieval_traces (
  model_run_id uuid NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  retrieval_trace_id uuid NOT NULL REFERENCES retrieval_traces(id),
  PRIMARY KEY (model_run_id, retrieval_trace_id)
);

-- ---------------------------------------------------------------------------
-- Row-Level Security (defense-in-depth)
-- ---------------------------------------------------------------------------

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_rls ON conversations
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_rls ON messages
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

ALTER TABLE model_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY model_runs_rls ON model_runs
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

ALTER TABLE model_run_retrieval_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY model_run_retrieval_traces_rls ON model_run_retrieval_traces
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR EXISTS (
      SELECT 1 FROM model_runs
      WHERE model_runs.id = model_run_retrieval_traces.model_run_id
        AND model_runs.workspace_id = current_setting('app.current_workspace_id', true)::uuid
    )
  );
