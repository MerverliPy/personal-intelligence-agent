-- Migration 003: Knowledge provenance and ingestion schema.
-- Creates the core tables for sources, stored files, documents, document
-- versions, and ingestion jobs. Document chunks, embeddings, and retrieval
-- tables are deferred to later migrations (005, 006, 007 respectively).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE document_version_status AS ENUM (
    'PENDING_UPLOAD',
    'UPLOADED',
    'QUARANTINED',
    'INGESTING',
    'READY',
    'FAILED',
    'SUPERSEDED',
    'DELETED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ingestion_job_status AS ENUM (
    'QUEUED',
    'RUNNING',
    'RETRY_WAIT',
    'SUCCEEDED',
    'FAILED_FINAL',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- sources
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- stored_files
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- document_versions
-- ---------------------------------------------------------------------------

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
CREATE UNIQUE INDEX document_versions_one_current_uq ON document_versions(document_id)
  WHERE is_current = true AND status = 'READY';
CREATE INDEX document_versions_workspace_status_idx ON document_versions(workspace_id, status, created_at DESC);

-- Deferred FK: documents.current_version_id -> document_versions.id
ALTER TABLE documents ADD CONSTRAINT documents_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES document_versions(id);

-- ---------------------------------------------------------------------------
-- ingestion_jobs
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Row-Level Security (defense-in-depth)
-- ---------------------------------------------------------------------------

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY sources_rls ON sources
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

ALTER TABLE stored_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY stored_files_rls ON stored_files
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_rls ON documents
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_versions_rls ON document_versions
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ingestion_jobs_rls ON ingestion_jobs
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );
