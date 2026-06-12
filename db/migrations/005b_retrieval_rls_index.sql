-- Migration 005b: Retrieval RLS hardening and vector index
--
-- Adds defense-in-depth RLS on retrieval_results (the only retrieval table
-- without it) and creates an IVFFlat vector index on chunk_embeddings for
-- production vector search performance.
--
-- Applied after 005_retrieval_schema and before 006_conversations.
--
-- RLS design:
--   retrieval_results has no direct workspace_id column, so the policy
--   joins through retrieval_traces.workspace_id to enforce tenant isolation.
--
-- Vector index:
--   IVFFlat is chosen over HNSW as the initial index because it is simpler
--   to tune and well-supported. The `lists` parameter should be tuned to
--   approximately sqrt(row_count) after corpus measurements; 100 is a
--   reasonable starting point for up to ~10,000 vectors.
--   REINDEX periodically as the corpus grows, or migrate to HNSW when
--   query latency becomes a concern.

-- ---------------------------------------------------------------------------
-- retrieval_results Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE retrieval_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY retrieval_results_rls ON retrieval_results
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR EXISTS (
      SELECT 1 FROM retrieval_traces
      WHERE retrieval_traces.id = retrieval_results.retrieval_trace_id
        AND retrieval_traces.workspace_id = current_setting('app.current_workspace_id', true)::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- chunk_embeddings vector index (IVFFlat)
-- ---------------------------------------------------------------------------
-- Replaces the previous comment-only placeholder in migration 004.
-- lists = 100 is appropriate for up to ~10,000 vectors.
-- Tune lists to sqrt(row_count) after measuring actual corpus size.

CREATE INDEX IF NOT EXISTS chunk_embeddings_vector_ivfflat_idx
  ON chunk_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
