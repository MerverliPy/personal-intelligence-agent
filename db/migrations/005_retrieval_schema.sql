-- Migration 005: Retrieval schema
--
-- Creates the retrieval_configs, retrieval_traces, and retrieval_results
-- tables required by the hybrid retrieval service (P2-T07).
--
-- Later migrations:
--   006 — conversations, messages, model_runs, citations
--   007 — feedback, memories, memory_versions
--   008 — tooling (tool_definitions, tool_connections, tool_runs, approval_requests)
--   009 — evaluation, improvement, feature_flags

-- ---------------------------------------------------------------------------
-- retrieval_configs
-- ---------------------------------------------------------------------------

CREATE TABLE retrieval_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  version text NOT NULL,
  configuration jsonb NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name, version)
);

-- ---------------------------------------------------------------------------
-- retrieval_traces
-- ---------------------------------------------------------------------------

CREATE TABLE retrieval_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL REFERENCES users(id),
  query_text text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  retrieval_config_id uuid NOT NULL REFERENCES retrieval_configs(id),
  result_count integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX retrieval_traces_workspace_created_idx ON retrieval_traces(workspace_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- retrieval_results
-- ---------------------------------------------------------------------------

CREATE TABLE retrieval_results (
  retrieval_trace_id uuid NOT NULL REFERENCES retrieval_traces(id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank > 0),
  chunk_id uuid NOT NULL REFERENCES document_chunks(id),
  lexical_score double precision,
  vector_score double precision,
  fused_score double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (retrieval_trace_id, rank),
  UNIQUE (retrieval_trace_id, chunk_id)
);

-- ---------------------------------------------------------------------------
-- Row-Level Security (defense-in-depth)
-- ---------------------------------------------------------------------------

ALTER TABLE retrieval_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY retrieval_configs_rls ON retrieval_configs
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

ALTER TABLE retrieval_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY retrieval_traces_rls ON retrieval_traces
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );
