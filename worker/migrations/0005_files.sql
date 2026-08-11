-- Arbitrary-file lane. Unlike drafts, files are NOT versioned: every upload mints a fresh
-- unguessable id and a fresh URL. Files are public-by-URL (like a public draft); access
-- control is the unguessable 22-char id, not a per-viewer check. Soft-delete + disable
-- columns mirror drafts so the takedown path is identical.
CREATE TABLE files (
  id                TEXT PRIMARY KEY,            -- 22-char base36, appears in /f/:id URL
  account_id        TEXT NOT NULL REFERENCES accounts(id),
  object_key        TEXT NOT NULL,               -- R2 key: files/{id}
  filename          TEXT NOT NULL,               -- original base name (download filename)
  content_type      TEXT NOT NULL,               -- declared/resolved MIME
  file_size         INTEGER NOT NULL,            -- bytes, from R2 after PUT
  created_by_key_id TEXT REFERENCES api_keys(id),
  idempotency_key   TEXT,                        -- dedupes agent retries
  source_ip         TEXT,
  cli_version       TEXT,
  disabled_at       TEXT,
  disabled_reason   TEXT,
  deleted_at        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_files_account ON files(account_id);
CREATE UNIQUE INDEX idx_files_idem ON files(account_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
