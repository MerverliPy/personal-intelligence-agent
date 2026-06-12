-- Add last_seen_at column to users (referenced by identity resolution)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

COMMENT ON COLUMN users.last_seen_at IS 'Timestamp of the most recent login';
