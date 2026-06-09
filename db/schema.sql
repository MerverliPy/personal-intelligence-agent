-- Reference schema for design and migration planning.
-- Implementation MUST use versioned migrations; do not apply this file directly to production.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE workspace_role AS ENUM ('OWNER','ADMIN','CURATOR','MEMBER','AUDITOR');
CREATE TYPE membership_status AS ENUM ('ACTIVE','INVITED','SUSPENDED','REMOVED');
CREATE TYPE sensitivity_class AS ENUM ('PUBLIC','INTERNAL','CONFIDENTIAL','HIGHLY_CONFIDENTIAL','REGULATED','PROHIBITED');
CREATE TYPE document_version_status AS ENUM ('PENDING_UPLOAD','UPLOADED','QUARANTINED','INGESTING','READY','FAILED','SUPERSEDED','DELETED');
CREATE TYPE ingestion_job_status AS ENUM ('QUEUED','RUNNING','RETRY_WAIT','SUCCEEDED','FAILED_FINAL','CANCELLED');
CREATE TYPE conversation_mode AS ENUM ('ASK','RESEARCH','ANALYZE','PLAN','EXECUTE','LEARN');
CREATE TYPE message_role AS ENUM ('USER','ASSISTANT','SYSTEM_NOTE','TOOL');
CREATE TYPE model_run_status AS ENUM ('CREATED','STREAMING','COMPLETED','CANCELLED','FAILED','INTERRUPTED');
CREATE TYPE feedback_category AS ENUM ('POSITIVE','NEGATIVE','INCORRECT','INCOMPLETE','CITATION_ISSUE','STYLE_ISSUE','UNSAFE');
CREATE TYPE memory_type AS ENUM ('PREFERENCE','PROFILE_FACT','PROJECT_FACT','RELATIONSHIP','DECISION','COMMITMENT','TERMINOLOGY','PROCEDURE','CORRECTION','TEMPORARY_STATE','HYPOTHESIS');
CREATE TYPE memory_status AS ENUM ('CANDIDATE','APPROVED','REJECTED','SUPERSEDED','EXPIRED','DELETED');
CREATE TYPE tool_risk_class AS ENUM ('READ_ONLY','REVERSIBLE_WRITE','CONSEQUENTIAL_WRITE','PROHIBITED');
CREATE TYPE tool_run_status AS ENUM ('PROPOSED','POLICY_DENIED','APPROVAL_PENDING','READY','EXECUTING','SUCCEEDED','FAILED_RETRYABLE','FAILED_FINAL','UNKNOWN_EXTERNAL_STATE');
CREATE TYPE approval_status AS ENUM ('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED','CONSUMED','REVOKED');
CREATE TYPE evaluation_run_status AS ENUM ('QUEUED','RUNNING','PASSED','FAILED','CANCELLED');
CREATE TYPE improvement_status AS ENUM ('PROPOSED','UNDER_REVIEW','APPROVED_FOR_EXPERIMENT','REJECTED','EXPERIMENT_PASSED','EXPERIMENT_FAILED','APPROVED_FOR_CANARY','CANARY_ACTIVE','PROMOTED','ROLLED_BACK');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX users_email_active_uq ON users (lower(email)) WHERE deleted_at IS NULL;

CREATE TABLE user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issuer text NOT NULL,
  subject text NOT NULL,
  claims_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  UNIQUE (issuer, subject)
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role workspace_role NOT NULL,
  status membership_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX workspace_members_user_idx ON workspace_members(user_id, status);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sensitivity sensitivity_class NOT NULL DEFAULT 'INTERNAL',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX projects_workspace_idx ON projects(workspace_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE project_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role workspace_role NOT NULL,
  status membership_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (workspace_id, user_id) REFERENCES workspace_members(workspace_id, user_id)
);

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  name text NOT NULL,
  authority_rank integer NOT NULL DEFAULT 100,
  sensitivity sensitivity_class NOT NULL DEFAULT 'INTERNAL',
  external_reference text,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX sources_workspace_project_idx ON sources(workspace_id, project_id, status);

CREATE TABLE stored_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  storage_provider text NOT NULL,
  object_key text NOT NULL,
  original_filename text NOT NULL,
  declared_mime_type text,
  detected_mime_type text,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  scan_status text NOT NULL DEFAULT 'PENDING',
  scan_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (storage_provider, object_key)
);
CREATE INDEX stored_files_workspace_checksum_idx ON stored_files(workspace_id, checksum_sha256) WHERE deleted_at IS NULL;

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  title text NOT NULL,
  sensitivity sensitivity_class NOT NULL DEFAULT 'INTERNAL',
  current_version_id uuid,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX documents_workspace_project_idx ON documents(workspace_id, project_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  stored_file_id uuid NOT NULL REFERENCES stored_files(id),
  version_number integer NOT NULL CHECK (version_number > 0),
  status document_version_status NOT NULL DEFAULT 'PENDING_UPLOAD',
  is_current boolean NOT NULL DEFAULT false,
  checksum_sha256 text NOT NULL,
  pipeline_version text,
  extraction_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_code text,
  failure_safe_message text,
  ready_at timestamptz,
  superseded_at timestamptz,
  deleted_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);
CREATE UNIQUE INDEX document_versions_one_current_uq ON document_versions(document_id) WHERE is_current = true AND status = 'READY';
CREATE INDEX document_versions_workspace_status_idx ON document_versions(workspace_id, status, created_at DESC);
ALTER TABLE documents ADD CONSTRAINT documents_current_version_fk FOREIGN KEY (current_version_id) REFERENCES document_versions(id);

CREATE TABLE ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  pipeline_version text NOT NULL,
  status ingestion_job_status NOT NULL DEFAULT 'QUEUED',
  stage text,
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_attempt_at timestamptz,
  error_code text,
  error_safe_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);
CREATE INDEX ingestion_jobs_status_idx ON ingestion_jobs(status, next_attempt_at, created_at);

CREATE TABLE document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  content text NOT NULL,
  content_hash text NOT NULL,
  locator jsonb NOT NULL,
  heading_path text[] NOT NULL DEFAULT '{}',
  token_count integer,
  chunking_version text NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content,''))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_version_id, ordinal)
);
CREATE INDEX document_chunks_version_idx ON document_chunks(workspace_id, document_version_id, ordinal);
CREATE INDEX document_chunks_search_idx ON document_chunks USING gin(search_vector);
CREATE INDEX document_chunks_hash_idx ON document_chunks(workspace_id, content_hash);

CREATE TABLE chunk_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  embedding_model text NOT NULL,
  embedding_dimensions integer NOT NULL CHECK (embedding_dimensions = 1536),
  embedding_version text NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chunk_id, embedding_model, embedding_version)
);
-- Create HNSW/IVFFlat only after corpus/query measurements. Example:
-- CREATE INDEX chunk_embeddings_hnsw_idx ON chunk_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TABLE retrieval_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  version text NOT NULL,
  configuration jsonb NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name, version)
);

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

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text,
  mode conversation_mode NOT NULL DEFAULT 'ASK',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  deleted_at timestamptz
);
CREATE INDEX conversations_workspace_project_idx ON conversations(workspace_id, project_id, updated_at DESC) WHERE deleted_at IS NULL;

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
CREATE INDEX messages_conversation_idx ON messages(conversation_id, created_at, id);

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
CREATE INDEX model_runs_workspace_created_idx ON model_runs(workspace_id, created_at DESC);

CREATE TABLE model_run_retrieval_traces (
  model_run_id uuid NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  retrieval_trace_id uuid NOT NULL REFERENCES retrieval_traces(id),
  PRIMARY KEY(model_run_id, retrieval_trace_id)
);

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

CREATE TABLE memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  user_scope_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type memory_type NOT NULL,
  status memory_status NOT NULL DEFAULT 'CANDIDATE',
  sensitivity sensitivity_class NOT NULL DEFAULT 'INTERNAL',
  current_version_id uuid,
  created_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX memories_scope_status_idx ON memories(workspace_id, project_id, user_scope_id, status);

CREATE TABLE memory_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  statement text NOT NULL,
  confidence double precision CHECK (confidence BETWEEN 0 AND 1),
  source_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  source_document_version_id uuid REFERENCES document_versions(id) ON DELETE SET NULL,
  rationale_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  supersedes_version_id uuid REFERENCES memory_versions(id),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(memory_id, version_number)
);
ALTER TABLE memories ADD CONSTRAINT memories_current_version_fk FOREIGN KEY (current_version_id) REFERENCES memory_versions(id);

CREATE TABLE tool_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text NOT NULL,
  description text NOT NULL,
  owner text NOT NULL,
  risk_class tool_risk_class NOT NULL,
  side_effects boolean NOT NULL,
  required_scopes text[] NOT NULL DEFAULT '{}',
  input_schema jsonb NOT NULL,
  output_schema jsonb NOT NULL,
  timeout_ms integer NOT NULL,
  retry_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_mode text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, version)
);

CREATE TABLE tool_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connector_type text NOT NULL,
  display_name text NOT NULL,
  secret_reference text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  sensitivity_ceiling sensitivity_class NOT NULL DEFAULT 'INTERNAL',
  status text NOT NULL DEFAULT 'ACTIVE',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, connector_type, display_name)
);

CREATE TABLE tool_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL REFERENCES users(id),
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  model_run_id uuid REFERENCES model_runs(id) ON DELETE SET NULL,
  tool_definition_id uuid NOT NULL REFERENCES tool_definitions(id),
  tool_connection_id uuid REFERENCES tool_connections(id),
  status tool_run_status NOT NULL DEFAULT 'PROPOSED',
  canonical_input jsonb NOT NULL,
  input_hash text NOT NULL,
  policy_decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  attempt integer NOT NULL DEFAULT 0,
  external_reference text,
  result_metadata jsonb,
  error_code text,
  error_safe_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, idempotency_key)
);
CREATE INDEX tool_runs_workspace_status_idx ON tool_runs(workspace_id, status, created_at DESC);

CREATE TABLE approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tool_run_id uuid NOT NULL UNIQUE REFERENCES tool_runs(id) ON DELETE CASCADE,
  status approval_status NOT NULL DEFAULT 'PENDING',
  input_hash text NOT NULL,
  summary text NOT NULL,
  requested_by uuid NOT NULL REFERENCES users(id),
  decided_by uuid REFERENCES users(id),
  decision_reason text,
  expires_at timestamptz NOT NULL,
  decided_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX approval_requests_pending_idx ON approval_requests(workspace_id, status, expires_at);

CREATE TABLE idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  principal_id uuid NOT NULL REFERENCES users(id),
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL,
  response_status integer,
  response_reference jsonb,
  locked_until timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, principal_id, operation, idempotency_key)
);

CREATE TABLE evaluation_suites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  version text NOT NULL,
  suite_type text NOT NULL,
  thresholds jsonb NOT NULL,
  scorer_versions jsonb NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name, version)
);

CREATE TABLE evaluation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_suite_id uuid NOT NULL REFERENCES evaluation_suites(id) ON DELETE CASCADE,
  external_case_id text NOT NULL,
  case_type text NOT NULL,
  input jsonb NOT NULL,
  expected jsonb NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  sensitivity sensitivity_class NOT NULL DEFAULT 'INTERNAL',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evaluation_suite_id, external_case_id)
);

CREATE TABLE evaluation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  evaluation_suite_id uuid NOT NULL REFERENCES evaluation_suites(id),
  status evaluation_run_status NOT NULL DEFAULT 'QUEUED',
  runtime_configuration jsonb NOT NULL,
  baseline_reference jsonb,
  candidate_reference jsonb,
  summary jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evaluation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_run_id uuid NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
  evaluation_case_id uuid NOT NULL REFERENCES evaluation_cases(id),
  passed boolean NOT NULL,
  scores jsonb NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_class text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evaluation_run_id, evaluation_case_id)
);

CREATE TABLE failure_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  failure_class text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  confidence double precision CHECK (confidence BETWEEN 0 AND 1),
  feedback_id uuid REFERENCES feedback(id) ON DELETE SET NULL,
  evaluation_result_id uuid REFERENCES evaluation_results(id) ON DELETE SET NULL,
  model_run_id uuid REFERENCES model_runs(id) ON DELETE SET NULL,
  description text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE improvement_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  candidate_type text NOT NULL,
  status improvement_status NOT NULL DEFAULT 'PROPOSED',
  title text NOT NULL,
  proposal jsonb NOT NULL,
  target_metrics jsonb NOT NULL,
  risk_class text NOT NULL,
  created_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE improvement_failure_links (
  improvement_candidate_id uuid NOT NULL REFERENCES improvement_candidates(id) ON DELETE CASCADE,
  failure_record_id uuid NOT NULL REFERENCES failure_records(id) ON DELETE CASCADE,
  PRIMARY KEY(improvement_candidate_id, failure_record_id)
);

CREATE TABLE feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT false,
  allocation jsonb NOT NULL DEFAULT '{}'::jsonb,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_type text NOT NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  outcome text NOT NULL,
  reason_code text,
  request_id uuid NOT NULL,
  trace_id text,
  policy_decision jsonb,
  redacted_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_workspace_time_idx ON audit_events(workspace_id, occurred_at DESC);
CREATE INDEX audit_events_request_idx ON audit_events(request_id);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  schema_version integer NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  attempt integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_events_pending_idx ON outbox_events(status, available_at, created_at);

COMMENT ON TABLE audit_events IS 'Append-only through application permissions; payloads must be redacted.';
COMMENT ON COLUMN tool_connections.secret_reference IS 'Reference to external secret manager; never plaintext credential material.';
COMMENT ON COLUMN model_runs.context_manifest IS 'References and inclusion metadata; do not store hidden chain-of-thought.';
