# API Reference

Base URL: `https://api.postplan.tapetide.com`
Public content is served from `https://postplan.tapetide.com`.

## Authentication

Bearer API key: `Authorization: Bearer ad_…`. Keys are scoped (`upload`, `read`,
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
Send **either** `html` **or** `markdown`. A `.md`/`.markdown` filename (or
`"format": "md"`) is also treated as Markdown, so a CLI can just send file bytes and let
the server decide.

```json
{
  "html": "<!DOCTYPE html>…",
  "markdown": "# Q3 Plan\n\nBody…",
  "format": "md",
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
  "public_url": "https://agentdraft-content.<sub>.workers.dev/d/abc123",
  "raw_url": ".../d/abc123/raw",
  "version_url": ".../d/abc123/v/3",
  "title": "…",
  "warnings": [],
  "idempotent_replay": false,
  "content_deduplicated": false
}
```
### Markdown

A Markdown upload is rendered **once at upload time** into a self-contained HTML
document. `GET /d/:id` serves that rendered document (so a human opens the URL and reads
formatted prose); `GET /d/:id/raw` serves the **exact Markdown source bytes** as
`text/markdown`, preserving the byte-for-byte guarantee. `X-AgentDraft-Format` reports
`md` or `html`, and the upload response includes `source_format`.

Rendering is **not** sanitising. Markdown permits raw HTML passthrough, so the rendered
output is run through the *same* authoritative validator as a direct HTML upload — a
`.md` file containing `<script>` is rejected with 422 `E_SCRIPT`. Markdown source is
capped at 1 MiB.

`content_deduplicated: true` means these exact bytes already existed for this draft, so
no new R2 object was written. A new version row is still created (history and its git
metadata stay accurate).
422 if HTML is rejected — includes an `errors: [{code, message}]` array.

### Google sign-in  *(dormant unless configured)*
```
GET  /api/auth/google/start      Returns { authorize_url } to redirect the user to
POST /api/auth/google/callback   Body { code, state } -> verifies id_token, mints session
```
Both return **503 `E_OAUTH_NOT_CONFIGURED`** when `GOOGLE_OAUTH_ENABLED` is not `"true"`
or the client credentials are absent.

### API keys  *(scope: manage)*
```
GET    /api/api-keys        List keys (never returns hashes/full keys)
POST   /api/api-keys        Create { name, scopes[] } → returns full key ONCE
                            Requires a Google-backed session when OAuth is configured
                            (403 E_GOOGLE_SIGNIN_REQUIRED otherwise)
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

### Visibility  *(scope: upload)*
```
PATCH /api/drafts/:id/visibility     { "public": bool }   one draft
POST  /api/drafts/visibility/bulk    { "public": bool }   EVERY draft in the account
PATCH /api/me/settings               { "default_draft_public": bool }
GET   /api/drafts/:id/content        owner-only bytes (?v=<n>, ?raw=1)
```
A draft is public by default. `PATCH /api/me/settings` changes the default for **new
drafts only** — existing drafts are never touched by it, because silently flipping links
already shared with reviewers is the one behaviour a preference must not have. The bulk
endpoint is the explicit opt-in and returns `changed`, the number of rows it actually
modified.

A non-owner gets `404`, not `403`, on every one of these: whether a draft exists is not
disclosed to someone who cannot read it.

`GET /api/drafts/:id/content` exists because the content origin is cookie-free and cannot
authorize anyone (see below). It streams the document with the same hardening headers plus
`Cache-Control: private, no-store`.

### Serving  *(no auth, content origin)*
```
GET /d/:id            Latest version
GET /d/:id/raw        Alias (same bytes)
GET /d/:id/v/:n       Specific version (immutable, cached 1y)
GET /d/:id/v/:n/raw   Alias
```
Response headers include a strict CSP, `X-Robots-Tag: noindex`,
`Cross-Origin-Resource-Policy`, `X-AgentDraft-Draft-Id`, `X-AgentDraft-Version`, and an `ETag`
of the content hash. Disabled drafts return 451; missing 404.

**Private drafts `302` to the dashboard**, they are never served here. This origin serves
attacker-controlled HTML, so a session must never be readable on it — which means it
cannot authorize a viewer. It redirects to `<dashboard>/private/d/:id…`, where the session
lives; the dashboard verifies ownership and streams the same bytes. The shared URL is
unchanged, so an owner just opens the link and sees the document, while anyone else lands
on sign-in and is returned to that exact draft afterwards. The redirect carries
`Cache-Control: private, no-store` and is a `302`, never a `301`, because visibility is
mutable and a permanent redirect would be cached past a later change.

`Cross-Origin-Resource-Policy` is `same-site`, not `same-origin`: CORP is a second
embedding gate independent of `frame-ancestors`, and `same-origin` blocks the dashboard's
own preview iframe while producing an identical blank frame.

**Conditional requests** are supported: send `If-None-Match: <etag>` to get a `304 Not
Modified` with no body (handles `*`, `W/` weak tags, and comma-separated lists). This is
honoured on cache hits too. `HEAD` returns headers plus `Content-Length` without reading
the object body. Versioned URLs (`/v/:n`) are immutable and cached for a year; the
mutable latest URL caches for 60s.

## Rate limits
Uploads 100/hour, reads 1000/hour (per key). 429 with `Retry-After` on exceed.

See [`docs/openapi.yaml`](./openapi.yaml) for the machine-readable spec.
