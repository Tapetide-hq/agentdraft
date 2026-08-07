# API Reference

Base URL: `https://webhost-api.<subdomain>.workers.dev`
Public content is served from `https://webhost-content.<subdomain>.workers.dev`.

## Authentication

Bearer API key: `Authorization: Bearer wh_…`. Keys are scoped (`upload`, `read`,
`manage`). Serving endpoints (`/d/*`) require no auth.

All error responses share one envelope:
```json
{ "ok": false, "error": { "code": "E_...", "message": "..." } }
```

## Endpoints

### `GET /` , `GET /api/health` , `GET /api/config`
Service info, health, and public config (whether OAuth is enabled, content base URL).

### `POST /api/bootstrap`  *(one-time, secret-guarded)*
Header: `X-Bootstrap-Secret: <secret>`. Body: `{ "name", "email"? }`. Creates the owner
account and first `manage` key. Returns the plaintext key once. 409 if already
bootstrapped.

### `GET /api/me`  *(key or session)*
Returns the current account, auth method, and scopes.

### `POST /api/upload`  *(scope: upload)*
Header (optional): `Idempotency-Key: <k>`.
```json
{
  "html": "<!DOCTYPE html>…",
  "filename": "plan.html",
  "project_id": "proj_…",     // optional
  "draft_id": "abc123",        // optional; update an existing draft
  "title": "…",                // optional; override extracted <title>
  "description": "…",          // optional
  "metadata": { "git_branch": "main", "git_commit_sha": "…", "git_dirty": false, "cli_version": "0.1.0" }
}
```
201 response:
```json
{
  "ok": true,
  "draft_id": "abc123",
  "version_number": 3,
  "content_hash": "…",
  "public_url": "https://webhost-content.<sub>.workers.dev/d/abc123",
  "raw_url": ".../d/abc123/raw",
  "version_url": ".../d/abc123/v/3",
  "title": "…",
  "warnings": [],
  "idempotent_replay": false,
  "content_deduplicated": false
}
```
`content_deduplicated: true` means these exact bytes already existed for this draft, so
no new R2 object was written. A new version row is still created (history and its git
metadata stay accurate).
422 if HTML is rejected — includes an `errors: [{code, message}]` array.

### API keys  *(scope: manage)*
```
GET    /api/api-keys        List keys (never returns hashes/full keys)
POST   /api/api-keys        Create { name, scopes[] } → returns full key ONCE
DELETE /api/api-keys/:id    Revoke
```

### Projects  *(key or session)*
```
GET    /api/projects        List
POST   /api/projects        Create { name, description?, repo_url? }
PATCH  /api/projects/:id    Update
DELETE /api/projects/:id    Archive
```

### Drafts  *(key or session)*
```
GET    /api/drafts              List (?project=, ?limit=)
GET    /api/drafts/:id          Metadata + version list
DELETE /api/drafts/:id          Soft-delete
```

### Serving  *(no auth, content origin)*
```
GET /d/:id            Latest version
GET /d/:id/raw        Alias (same bytes)
GET /d/:id/v/:n       Specific version (immutable, cached 1y)
GET /d/:id/v/:n/raw   Alias
```
Response headers include a strict CSP, `X-Robots-Tag: noindex`,
`Cross-Origin-Resource-Policy`, `X-WebHost-Draft-Id`, `X-WebHost-Version`, and an `ETag`
of the content hash. Disabled drafts return 451; private drafts 403; missing 404.

**Conditional requests** are supported: send `If-None-Match: <etag>` to get a `304 Not
Modified` with no body (handles `*`, `W/` weak tags, and comma-separated lists). This is
honoured on cache hits too. `HEAD` returns headers plus `Content-Length` without reading
the object body. Versioned URLs (`/v/:n`) are immutable and cached for a year; the
mutable latest URL caches for 60s.

## Rate limits
Uploads 100/hour, reads 1000/hour (per key). 429 with `Retry-After` on exceed.

See [`docs/openapi.yaml`](./openapi.yaml) for the machine-readable spec.
