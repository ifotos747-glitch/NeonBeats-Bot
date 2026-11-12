-- NeonBeats Web Control 3.0 — Cloudflare D1
-- Do not store bot tokens in the database. Use encrypted Worker Secrets.
CREATE TABLE IF NOT EXISTS oauth_states (
 state TEXT PRIMARY KEY NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 access_token TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiration ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS snapshots (
 guild_id TEXT PRIMARY KEY NOT NULL,
 payload TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_updated ON snapshots(updated_at);
CREATE TABLE IF NOT EXISTS commands (
 id TEXT PRIMARY KEY NOT NULL,
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 action TEXT NOT NULL,
 value TEXT,
 status TEXT NOT NULL DEFAULT 'pending',
 created_at INTEGER NOT NULL,
 result TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_commands_pending ON commands(status,created_at);
CREATE INDEX IF NOT EXISTS idx_commands_user ON commands(user_id,created_at);
