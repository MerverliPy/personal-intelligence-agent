-- PostgreSQL initialization for the pia development database.
-- Executed automatically by the pgvector Docker entrypoint on first start.

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm extension for trigram-based text search acceleration
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid-ossp for UUID generation support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
