-- Migration 002: Row-Level Security (RLS) defense-in-depth
--
-- Enables RLS on all tenant-scoped tables and creates permissive policies
-- that allow backward-compatible operation while the application is updated
-- to set the workspace context.
--
-- How it works:
--   - When `app.current_workspace_id` is NOT set: all rows are visible
--     (backward compatible — no app changes required to run).
--   - When `app.current_workspace_id` IS set: rows are filtered to the
--     current workspace (defense-in-depth against authorization bugs).
--
-- Application integration (future):
--   At the start of each transaction, call:
--     SELECT set_config('app.current_workspace_id', $1::text, true);
--   This activates RLS filtering for that transaction.
--
-- Revert:
--   To disable RLS, run:
--     ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;
--   for each table listed below.

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_members_rls ON workspace_members
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_rls ON projects
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- project_members
-- ---------------------------------------------------------------------------
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_members_rls ON project_members
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- outbox_events
-- ---------------------------------------------------------------------------
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY outbox_events_rls ON outbox_events
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- idempotency_records
-- ---------------------------------------------------------------------------
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY idempotency_records_rls ON idempotency_records
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_events_rls ON audit_events
  FOR ALL
  USING (
    current_setting('app.current_workspace_id', true) IS NULL
    OR workspace_id = current_setting('app.current_workspace_id', true)::uuid
  );
