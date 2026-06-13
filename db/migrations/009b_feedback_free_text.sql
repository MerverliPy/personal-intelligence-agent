-- Migration 009b: Add FREE_TEXT value to feedback_category enum
--
-- Closes the gap between FR-FBK-001 (which requires 8 feedback categories
-- including "free-text correction") and migration 009_feedback.sql (which
-- created the enum with only 7 values).
--
-- This migration is additive: it does not modify or drop any existing
-- enum values, table data, or RLS policies. Existing rows are unaffected.
--
-- Requires PostgreSQL 12+ for `ALTER TYPE ... ADD VALUE IF NOT EXISTS`
-- inside a transaction block. The development stack (compose.yaml) uses
-- pgvector/pgvector:pg17, so this is satisfied locally.
--
-- Per FR-FBK-004: free-text feedback is stored verbatim and treated as
-- untrusted data. It is NEVER interpreted as instruction. Storage is
-- plain text; the render layer is responsible for HTML escaping.

ALTER TYPE feedback_category ADD VALUE IF NOT EXISTS 'FREE_TEXT';
