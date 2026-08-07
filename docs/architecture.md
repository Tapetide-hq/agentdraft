# Architecture

AgentDraft is a Cloudflare-native monorepo with four deployables and three data stores.

## Components

| Component | Runtime | Origin | Role |
|---|---|---|---|
| `worker/` | Workers (Hono/TS) | `agentdraft-api.<sub>.workers.dev` | API, auth, uploads, validation |
| `content-worker/` | Workers (TS) | `agentdraft-content.<sub>.workers.dev` | Serves user HTML, isolated |
| `dashboard/` | SvelteKit on Workers | `agentdraft-dashboard.<sub>.workers.dev` | Human UI (BFF) |
| `cli/` | Go binary | — | Agent/developer interface |
| D1 | SQLite at edge | — | Metadata |
| R2 | Object store | — | HTML blobs |
| KV | Key-value | — | Rate-limit counters |

## Why two content-serving origins

The single most important decision. Uploaded HTML is attacker-controlled. Serving it
from the same origin as the authenticated dashboard would make any CSP bypass a path to
account takeover. The API/dashboard and the user HTML live on **separate origins**, so a
successful bypass is contained to a page the attacker already controls. See
[SECURITY.md](../SECURITY.md).

## Request flows

### Upload (`POST /api/upload`)
```
CLI/agent → agentdraft-api
  1. auth (bearer key) + scope check + rate limit
  2. validate HTML (parse5) — reject on any active content
  3. allocate version: UPDATE drafts SET last_allocated_version = +1 RETURNING  (atomic)
  4. R2 PUT the exact bytes           ← R2 first: an orphan blob is harmless
  5. D1 batch: INSERT version row + advance published_version via MAX()
  → returns the public content URL
```

### Serve (`GET /d/:id`)
```
Browser → agentdraft-content
  1. Cache API lookup (keyed on URL only, so conditional headers don't fragment it)
     - on hit, STILL honour If-None-Match → 304, else return the cached response
  2. look up draft + resolve version in D1
  3. If-None-Match matches the content-hash ETag? → 304, no R2 read at all
  4. HEAD? → R2 head() for metadata + Content-Length, never open a body
  5. GET → stream obj.body straight through (no buffering)
  6. respond with the exact bytes + strict CSP + noindex + no cookies
```
The content hash IS the ETag (identical bytes → identical tag, and stored objects are
immutable, so it's a strong validator). Versioned `/v/:n` URLs are immutable and cached
for a year; the mutable latest URL caches 60s.

### Dashboard (BFF)
```
Browser → agentdraft-dashboard (SvelteKit server)
  - API key in httpOnly cookie on the dashboard origin (never in client JS)
  - server-side calls agentdraft-api via a SERVICE BINDING (env.API), not a public fetch
    (a public workers.dev fetch to a sibling worker fails with CF error 1042)
```

## Version allocation & crash safety

`drafts.last_allocated_version` is an atomic counter incremented with
`UPDATE … RETURNING`, race-free on D1 (no interactive transactions needed).
`UNIQUE(draft_id, version_number)` is a backstop. `published_version` is advanced with
`MAX()` so concurrent uploads finishing out of order cannot move "latest" backward.

**Content deduplication.** Before writing, the upload path looks for an existing
version of the *same draft* with the same content hash. If one exists and the object is
confirmed still present in R2 (`head()`), the new version row reuses that object key —
skipping the R2 write and storing no duplicate bytes, while keeping an accurate version
history. Dedup is scoped per-draft on purpose: sharing objects across drafts would let
one draft's deletion break another's content. The response reports
`content_deduplicated`.

R2 is written **before** the D1 version row. Crash outcomes:

- After allocation, before R2: a burned version number (gaps are fine).
- After R2, before D1: an unreferenced R2 orphan (harmless, GC-able).
- After D1: metadata references an existing object.

A public D1 row pointing at a missing R2 object is never created.

## ID scheme

`acct_`+16, `key_`+16, `proj_`+12, `ver_`+16, draft ids are 12 bare chars (used in the
URL), API keys are `ad_`+40. Alphabet is lowercase + digits (URL-friendly).
