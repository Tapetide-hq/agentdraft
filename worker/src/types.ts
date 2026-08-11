export interface Account {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  google_sub: string | null;
  is_owner: number;
  // Default visibility applied to NEWLY created drafts (1 = public). Existing drafts are
  // never affected by changing this — see migration 0004.
  default_draft_public: number;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyRow {
  id: string;
  account_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string;
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  account_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  auth_method: string;
}

export interface Project {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  repo_url: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Draft {
  id: string;
  project_id: string | null;
  account_id: string;
  title: string;
  description: string | null;
  last_allocated_version: number;
  published_version: number | null;
  current_version_id: string | null;
  is_public: number;
  disabled_at: string | null;
  disabled_reason: string | null;
  deleted_at: string | null;
  source_format: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftVersion {
  id: string;
  draft_id: string;
  version_number: number;
  object_key: string;
  content_hash: string;
  file_size: number;
  title: string | null;
  original_filename: string | null;
  created_by_key_id: string | null;
  idempotency_key: string | null;
  source_ip: string | null;
  cli_version: string | null;
  git_branch: string | null;
  git_commit_sha: string | null;
  git_dirty: number | null;
  source_format: string | null;
  created_at: string;
}

// The authenticated principal attached to a request by the auth middleware.
export interface AuthContext {
  account: Account;
  via: "key" | "session";
  keyId?: string;
  scopes: string[];
  // How the principal proved identity. Only "google" satisfies the key-minting gate:
  // a leaked API key must not be able to mint further keys.
  authMethod: "key" | "google";
}

export interface UploadMetadata {
  git_branch?: string;
  git_commit_sha?: string;
  git_dirty?: boolean;
  cli_version?: string;
}

export interface UploadRequest {
  html: string;
  filename?: string;
  project_id?: string;
  draft_id?: string;
  title?: string;
  description?: string;
  metadata?: UploadMetadata;
}

// A stored arbitrary file (the file lane — NOT a draft). Files are unversioned: each
// upload mints a fresh id + URL. Public by unguessable id, like a public draft.
export interface FileRow {
  id: string;
  account_id: string;
  object_key: string;
  filename: string;
  content_type: string;
  file_size: number;
  created_by_key_id: string | null;
  idempotency_key: string | null;
  source_ip: string | null;
  cli_version: string | null;
  disabled_at: string | null;
  disabled_reason: string | null;
  deleted_at: string | null;
  created_at: string;
}
