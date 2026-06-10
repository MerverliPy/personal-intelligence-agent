-- Migration 004: Document chunks and chunk embeddings
--
-- Adds the document_chunks and chunk_embeddings tables required by the
-- ingestion pipeline (P2-T03). These tables are referenced by the staged
-- ingestion workflow for chunk persistence and embedding idempotency.
--
-- Real chunking/embedding logic is implemented in P2-T05 and P2-T06.
-- This migration creates the storage surface so the workflow orchestrator
-- (P2-T03) can coordinate the full pipeline end-to-end.

-- ---------------------------------------------------------------------------
-- document_chunks
-- ---------------------------------------------------------------------------

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
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_version_id, ordinal)
);

CREATE INDEX document_chunks_version_idx ON document_chunks(workspace_id, document_version_id, ordinal);
CREATE INDEX document_chunks_search_idx ON document_chunks USING gin(search_vector);
CREATE INDEX document_chunks_hash_idx ON document_chunks(workspace_id, content_hash);

-- ---------------------------------------------------------------------------
-- chunk_embeddings
-- ---------------------------------------------------------------------------

CREATE TABLE chunk_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  embedding_model text NOT NULL,
  embedding_dimensions integer NOT NULL CHECK (embedding_dimensions = 1536),
  embedding_version text NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chunk_id, embedding_model, embedding_version)
);

-- Index for embedding search (HNSW/IVFFlat deferred to corpus measurements)
CREATE INDEX chunk_embeddings_workspace_idx ON chunk_embeddings(workspace_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security (defense-in-depth)
-- ---------------------------------------------------------------------------

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_chunks_rls ON document_chunks
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

ALTER TABLE chunk_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY chunk_embeddings_rls ON chunk_embeddings
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );
