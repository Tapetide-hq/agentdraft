-- WebHost initial schema (D1 / SQLite).
--
-- Design notes:
--  * v1 is invite-only: publishing requires an API key tied to an account. There is
--    NO anonymous-upload table (Fusion review WEBHOST-CF-ARCH-9931). Public READING
--    is anonymous; it needs no row here beyond the draft being is_public=1.
--  * Google OAuth is a schema SEAM only: accounts.google_sub is nullable and unused
--    by v1's bootstrap+API-key+session auth. No dead callback code ships.
--  * Version allocation uses drafts.last_allocated_version as an atomic counter
--    (UPDATE ... RETURNING), with UNIQUE(draft_id, version_number) as a backstop.
--  * drafts.published_version is advanced with MAX() so out-of-order concurrent
--    uploads can never move "latest" backward.

CREATE TABLE accounts (
  id            TEXT PRIMARY KEY,            -- "acct_" + 16
  name          TEXT NOT NULL,
  email         TEXT,
  avatar_url    TEXT,
  google_sub    TEXT UNIQUE,                 -- OAuth seam; nullable, unused in v1
  is_owner      INTEGER NOT NULL DEFAULT 0,  -- the bootstrap owner
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE api_keys (
  id            TEXT PRIMARY KEY,            -- "key_" + 16
  account_id    TEXT NOT NULL REFERENCES accounts(id),
  name          TEXT NOT NULL,
  key_prefix    TEXT NOT NULL,               -- visible prefix, e.g. "wh_ab12cd34"
  key_hash      TEXT NOT NULL UNIQUE,        -- domain-separated SHA-256 of full key
  scopes        TEXT NOT NULL DEFAULT 'upload,read',
  last_used_at  TEXT,
  revoked_at    TEXT,
  expires_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dashboard sessions: user pastes a scoped key once, we mint a random revocable
-- session and set a __Host- cookie. The cookie value is NOT the API key.
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,            -- "sess_" + 24, the random cookie value
  account_id    TEXT NOT NULL REFERENCES accounts(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at    TEXT NOT NULL,
  revoked_at    TEXT
);

CREATE TABLE projects (
  id            TEXT PRIMARY KEY,            -- "proj_" + 12
  account_id    TEXT NOT NULL REFERENCES accounts(id),
  name          TEXT NOT NULL,
  description   TEXT,
  repo_url      TEXT,
  archived_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE drafts (
  id                     TEXT PRIMARY KEY,   -- 12 chars, no prefix, used in URL
  project_id             TEXT REFERENCES projects(id),
  account_id             TEXT NOT NULL REFERENCES accounts(id),
  title                  TEXT NOT NULL DEFAULT 'Untitled',
  description            TEXT,
  last_allocated_version INTEGER NOT NULL DEFAULT 0,  -- atomic allocation counter
  published_version      INTEGER,                     -- current "latest" (MAX-advanced)
  current_version_id     TEXT,
  is_public              INTEGER NOT NULL DEFAULT 1,
  disabled_at            TEXT,
  disabled_reason        TEXT,
  deleted_at             TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE draft_versions (
  id                TEXT PRIMARY KEY,        -- "ver_" + 16
  draft_id          TEXT NOT NULL REFERENCES drafts(id),
  version_number    INTEGER NOT NULL,
  object_key        TEXT NOT NULL,           -- R2 key: drafts/{draft_id}/{version_id}.html
  content_hash      TEXT NOT NULL,           -- sha256 of HTML bytes
  file_size         INTEGER NOT NULL,
  title             TEXT,
  original_filename TEXT,
  created_by_key_id TEXT REFERENCES api_keys(id),
  idempotency_key   TEXT,                    -- client-supplied, dedupes agent retries
  source_ip         TEXT,
  cli_version       TEXT,
  git_branch        TEXT,
  git_commit_sha    TEXT,
  git_dirty         INTEGER,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(draft_id, version_number)
);

-- Abuse reports for served content (public takedown path).
CREATE TABLE abuse_reports (
  id          TEXT PRIMARY KEY,              -- "rep_" + 16
  draft_id    TEXT NOT NULL,
  reason      TEXT NOT NULL,
  reporter_ip TEXT,
  detail      TEXT,
  resolved_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_api_keys_account   ON api_keys(account_id);
CREATE INDEX idx_sessions_account   ON sessions(account_id);
CREATE INDEX idx_projects_account   ON projects(account_id);
CREATE INDEX idx_drafts_project     ON drafts(project_id);
CREATE INDEX idx_drafts_account     ON drafts(account_id);
CREATE INDEX idx_versions_draft     ON draft_versions(draft_id);
CREATE UNIQUE INDEX idx_versions_idem ON draft_versions(draft_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
