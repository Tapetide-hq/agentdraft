# AgentDraft File Uploads — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add an arbitrary-file lane to agentdraft — `agentdraft file <path>` uploads any
local file (screenshot, screen recording, log, PDF, zip, archive) and returns a stable
public URL, replacing our dependency on Theo's `files.tslop.org` host.

**Architecture:** Option A (shared origin). Reuse the existing `agentdraft-api` +
`agentdraft-content` workers, the `agentdraft-html` R2 bucket, `agentdraft-db` D1, and the
Go CLI. Files get their own `files` table (no versioning — each upload is a fresh
unguessable id, matching Theo's model), a new streaming `POST /api/files` endpoint, and a
new `GET /f/:id` serve route on the content worker. **The security rule that keeps files
safe on the shared document origin: every served file is `Content-Disposition: attachment`
+ `X-Content-Type-Options: nosniff` UNLESS its declared MIME is on a strict inline
allowlist (images, mp4, mp3, plain text, PDF). `image/svg+xml` and `text/html` are NEVER
inline — that is the one rule that prevents a "file" being served as an executable page on
the origin that also holds documents.**

**Tech Stack:** Cloudflare Workers (Hono, TypeScript), R2, D1 (SQLite), Go CLI (cobra),
wrangler 4, vitest.

**Prior art:** Built in `docs/plans/2026-08-07-webhost-implementation.md`. This extends it;
do not rewrite the draft path.

**Constraints (verified live):**
- Cloudflare Free plan request-body cap = **100 MB** → `MAX_FILE_BYTES = 100 * 1024 * 1024`.
- Worker memory is 128 MB → upload MUST stream `request.body` straight into `STORAGE.put`
  (never buffer with `.arrayBuffer()`), and serve MUST stream the R2 body straight out.
- Draft ids are 22-char base36 (`newDraftId`), route regex on the content worker accepts
  `[a-z0-9]{6,32}`. File ids reuse the same 22-char generator; the `/f/` route gets its own
  regex so file ids and draft ids never collide across namespaces.
- `upload` scope authorizes writes; reads are public (unguessable id + `is_public`-style
  gate), exactly like public drafts.

---

## Phase 0 — Pre-flight (no behavior change)

Baseline already verified on `main`: `bun run typecheck` clean, `vitest` 60/60 pass. Work
happens in worktree `/root/webhost-files` on branch `feat/file-uploads`.

### Task 0.1: Shared file-serving policy constants

**Objective:** One source of truth for the size cap and the inline allowlist, imported by
both workers so they can never drift.

**Files:**
- Create: `worker/src/services/files.ts`

```ts
// Shared policy for the arbitrary-file lane. Imported by the API worker (upload) and
// mirrored by convention in the content worker (serve). The two workers do not share a
// module at runtime, so the content worker re-declares INLINE_ALLOWLIST with a comment
// pointing here — keep them identical.

// Cloudflare Free plan caps the REQUEST BODY at 100 MB (verified against
// developers.cloudflare.com/workers/platform/limits). This is the real ceiling; Worker
// memory (128 MB) is not, because we stream to R2 and never buffer the body.
export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MiB

// The ONLY MIME types served inline (Content-Disposition: inline). Everything else is
// forced to download (attachment). This is the core safety gate: a file whose declared
// type is text/html or image/svg+xml is NOT here, so it can never be rendered as an
// executable document on this origin — which is the same origin that serves drafts.
//
// Paired ALWAYS with X-Content-Type-Options: nosniff, so a file that lies about its type
// (claims image/png but is really HTML) is still treated as the declared type and cannot
// be reinterpreted as markup by the browser.
export const INLINE_ALLOWLIST = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "text/plain",
  "application/pdf",
]);

export function isInlineType(contentType: string): boolean {
  // Strip any charset/parameter before matching: "text/plain; charset=utf-8" -> "text/plain"
  const base = contentType.split(";")[0].trim().toLowerCase();
  return INLINE_ALLOWLIST.has(base);
}

// Extension -> MIME fallback for when a client sends no/blank Content-Type. Conservative:
// anything unknown becomes application/octet-stream, which is NOT on the inline allowlist
// and therefore downloads. We never guess an inline type from an extension we don't know.
const EXT_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", avif: "image/avif", svg: "image/svg+xml",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav",
  pdf: "application/pdf", txt: "text/plain", log: "text/plain",
  json: "application/json", csv: "text/csv", md: "text/markdown",
  html: "text/html", htm: "text/html",
  zip: "application/zip", gz: "application/gzip", tar: "application/x-tar",
};

export function mimeFromFilename(filename: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

// Resolve the MIME we STORE and SERVE. A client-provided type wins only when non-blank;
// otherwise fall back to the extension. Note: trusting the client type is SAFE because the
// inline decision is gated by INLINE_ALLOWLIST + nosniff, not by belief in the client.
export function resolveContentType(clientType: string | null, filename: string): string {
  const c = (clientType ?? "").split(";")[0].trim().toLowerCase();
  if (c && c !== "application/octet-stream") return c;
  return mimeFromFilename(filename);
}

// R2 object key for a file. Namespaced under files/ so it never collides with drafts/.
export function fileObjectKey(id: string): string {
  return `files/${id}`;
}
```

**Step: verify** — `cd worker && bun run typecheck` → clean.

**Commit:** `feat(files): shared file-serving policy constants`

---

## Phase 1 — Database

### Task 1.1: `files` migration

**Objective:** A dedicated table for arbitrary files. No versioning (each upload is a new
id + new URL, matching Theo's model), but it carries takedown + soft-delete columns for
parity with drafts.

**Files:**
- Create: `worker/migrations/0005_files.sql`

```sql
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
```

**Step: apply locally then remote**

```bash
cd worker
bunx wrangler d1 migrations apply agentdraft-db --local   # dev
# remote applied in Phase 7 deploy, NOT now
```

**Step: add the type** — append to `worker/src/types.ts`:

```ts
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
```

**Commit:** `feat(files): 0005 files table + FileRow type`

---

## Phase 2 — API worker: streaming upload

### Task 2.1: `POST /api/files` route

**Objective:** Accept a raw request body, stream it to R2 without buffering, record a row,
return a public URL. Requires `upload` scope. Filename + content-type arrive as headers so
the body stays pure bytes (streamable).

**Files:**
- Create: `worker/src/routes/files.ts`
- Modify: `worker/src/index.ts` (register route under `upload` scope)

`worker/src/routes/files.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "../env.js";
import type { AuthContext, FileRow } from "../types.js";
import { jsonError, clientIp } from "../lib/http.js";
import { MAX_FILE_BYTES, resolveContentType, fileObjectKey } from "../services/files.js";
import { newDraftId } from "../services/id.js";

type Vars = { Variables: { auth: AuthContext }; Bindings: Env };
const files = new Hono<Vars>();

// POST /api/files
// Body: raw file bytes (streamed).
// Headers: X-Filename (required), Content-Type (optional), Idempotency-Key (optional).
files.post("/", async (c) => {
  const auth = c.get("auth");

  const rawName = c.req.header("x-filename") ?? "";
  // Use only the base name; strip any path a client accidentally sent. Reject empties and
  // control chars. The stored name is what a browser downloads AS, so keep it sane.
  const filename = rawName.split(/[\\/]/).pop()?.trim() ?? "";
  if (!filename || filename.length > 255 || /[\x00-\x1f]/.test(filename)) {
    return jsonError(c, 400, "E_BAD_FILENAME", "A valid X-Filename header is required.");
  }

  // Reject oversize up front via Content-Length when present (saves streaming a body we
  // will refuse). The stream guard below is the real enforcement — a client can lie about
  // or omit Content-Length.
  const declaredLen = Number(c.req.header("content-length") ?? "0");
  if (declaredLen > MAX_FILE_BYTES) {
    return jsonError(c, 413, "E_TOO_LARGE",
      `File is ${declaredLen} bytes; limit is ${MAX_FILE_BYTES}.`);
  }

  const body = c.req.raw.body;
  if (!body) return jsonError(c, 400, "E_NO_CONTENT", "Request body is required.");

  const contentType = resolveContentType(c.req.header("content-type") ?? null, filename);
  const idempotencyKey = c.req.header("idempotency-key") ?? null;

  // Idempotency: an agent retry with the same key returns the existing file, no new object.
  if (idempotencyKey) {
    const existing = await c.env.DB.prepare(
      "SELECT * FROM files WHERE account_id = ? AND idempotency_key = ? AND deleted_at IS NULL",
    ).bind(auth.account.id, idempotencyKey).first<FileRow>();
    if (existing) return c.json(makeResponse(c.env, existing, true));
  }

  const id = newDraftId(); // 22-char base36 generator, reused for files
  const key = fileObjectKey(id);

  // Stream the body straight to R2. A MAX_FILE_BYTES guard wraps the stream so a client
  // that omits/lies about Content-Length still cannot exceed the cap — we abort the PUT.
  let total = 0;
  const capped = body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        total += chunk.byteLength;
        if (total > MAX_FILE_BYTES) {
          ctrl.error(new Error("E_TOO_LARGE"));
          return;
        }
        ctrl.enqueue(chunk);
      },
    }),
  );

  try {
    await c.env.STORAGE.put(key, capped, {
      httpMetadata: { contentType },
      customMetadata: {
        account_id: auth.account.id,
        filename,
        uploaded_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "E_TOO_LARGE") {
      return jsonError(c, 413, "E_TOO_LARGE", `File exceeds the ${MAX_FILE_BYTES}-byte limit.`);
    }
    return jsonError(c, 500, "E_STORAGE", "Failed to store the file.");
  }

  // Read back the authoritative size from R2 (the stream counter is advisory).
  const head = await c.env.STORAGE.head(key);
  const size = head?.size ?? total;

  await c.env.DB.prepare(
    `INSERT INTO files
      (id, account_id, object_key, filename, content_type, file_size,
       created_by_key_id, idempotency_key, source_ip, cli_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, auth.account.id, key, filename, contentType, size,
    auth.keyId ?? null, idempotencyKey, clientIp(c),
    c.req.header("x-cli-version") ?? null,
  ).run();

  const row = await c.env.DB.prepare("SELECT * FROM files WHERE id = ?")
    .bind(id).first<FileRow>();
  return c.json(makeResponse(c.env, row!, false), 201);
});

function makeResponse(env: Env, f: FileRow, idempotentReplay: boolean) {
  const base = env.CONTENT_BASE_URL.replace(/\/$/, "");
  return {
    ok: true,
    file_id: f.id,
    public_url: `${base}/f/${f.id}`,
    filename: f.filename,
    content_type: f.content_type,
    file_size: f.file_size,
    idempotent_replay: idempotentReplay,
  };
}

export default files;
```

`worker/src/index.ts` — register beside the upload route (both need `upload` scope):

```ts
import filesRoute from "./routes/files.js";
// ... after the uploadRoute registration:
app.use("/api/files", requireAuth(), requireScope("upload"));
app.route("/api/files", filesRoute);
```

**Step: verify** — `bun run typecheck` → clean.

**Commit:** `feat(files): streaming POST /api/files upload endpoint`

### Task 2.2: Unit test the upload guards

**Files:**
- Create: `worker/test/files.test.ts`

Cover: (a) missing `X-Filename` → 400 `E_BAD_FILENAME`; (b) filename with a path is
base-named; (c) oversize `Content-Length` → 413; (d) blank content-type falls back to
extension MIME; (e) idempotency replay returns the same `file_id`. Use the existing vitest
Worker test harness pattern from `test/validate.test.ts`.

**Step: verify** — `bun run test` → all pass (existing 60 + new).

**Commit:** `test(files): upload endpoint guards`

---

## Phase 3 — Content worker: serving

### Task 3.1: `GET /f/:id` serve route with attachment-default + range support

**Objective:** Serve a stored file. Default `Content-Disposition: attachment`; inline only
for the allowlist. Always `nosniff`. Honor `Range` so mp4/webm seek in the browser.

**Files:**
- Modify: `content-worker/src/index.ts`

Add, near the top, a mirror of the inline allowlist (comment: keep identical to
`worker/src/services/files.ts`):

```ts
const INLINE_ALLOWLIST = new Set<string>([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif",
  "video/mp4", "video/webm", "audio/mpeg", "audio/mp4",
  "text/plain", "application/pdf",
]);
function isInlineType(ct: string): boolean {
  return INLINE_ALLOWLIST.has(ct.split(";")[0].trim().toLowerCase());
}
```

Add a route match BEFORE the draft match, and a handler. Route regex: `^/f/([a-z0-9]{6,32})$`.

Handler logic:
1. `SELECT id, object_key, filename, content_type, file_size, disabled_at, disabled_reason, deleted_at FROM files WHERE id = ?`.
2. `!row || row.deleted_at` → 404. `row.disabled_at` → 451.
3. Build headers:
   - `Content-Type: <row.content_type>`
   - `X-Content-Type-Options: nosniff` (ALWAYS)
   - `Content-Disposition: <inline|attachment>; filename="<sanitized>"` — inline only when
     `isInlineType(row.content_type)`. Sanitize filename for the header (strip `"` and
     control chars; RFC 5987 `filename*` for non-ASCII).
   - `Content-Security-Policy: default-src 'none'; sandbox`
   - `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`
   - `Cross-Origin-Resource-Policy: same-origin` (files are NOT embedded in the dashboard
     preview, so this can be strict — unlike the draft path).
   - `Cache-Control: public, max-age=31536000, immutable` (a file id is immutable — its
     bytes never change, so it caches hard, like a versioned draft URL).
   - `ETag: "<object_key>"` (immutable; the key is unique per upload).
4. Honor `If-None-Match` → 304.
5. `Range` header present → parse `bytes=start-end`, `STORAGE.get(key, { range })`, return
   206 with `Content-Range` + `Accept-Ranges: bytes`. Malformed/unsatisfiable range → 416.
6. `HEAD` → `STORAGE.head`, return metadata + `Content-Length`, no body.
7. `GET` no range → `STORAGE.get(key)`, stream `obj.body` through, 200, `Accept-Ranges: bytes`.
8. Cache full 200 responses via `caches.default` (do NOT cache 206 partials — the Cache
   API keys on URL, and a cached partial would be served to a client asking for the whole).

**Step: verify** — `cd content-worker && bun run typecheck` → clean.

**Commit:** `feat(files): GET /f/:id serve route (attachment-default, inline allowlist, ranges)`

---

## Phase 4 — CLI: `agentdraft file`

### Task 4.1: API client method

**Files:**
- Modify: `cli/internal/api/client.go`, `cli/internal/api/types.go`

Add `UploadFileResponse` type (fields: `OK`, `FileID`, `PublicURL`, `Filename`,
`ContentType`, `FileSize`, `IdempotentReplay`). Add:

```go
// UploadFile streams a raw file to POST /api/files. Filename + content type go in headers
// so the body is pure bytes and can be streamed without buffering the whole file.
func (c *Client) UploadFile(path, contentType, idempotencyKey string) (*UploadFileResponse, error) {
    f, err := os.Open(path)
    if err != nil { return nil, err }
    defer f.Close()
    st, err := f.Stat()
    if err != nil { return nil, err }

    req, err := http.NewRequest(http.MethodPost, c.baseURL+"/api/files", f)
    if err != nil { return nil, err }
    req.ContentLength = st.Size() // enables streaming without chunked encoding
    req.Header.Set("Authorization", "Bearer "+c.apiKey)
    req.Header.Set("X-Filename", filepath.Base(path))
    if contentType != "" { req.Header.Set("Content-Type", contentType) }
    if idempotencyKey != "" { req.Header.Set("Idempotency-Key", idempotencyKey) }
    // ... c.httpClient.Do, status check (201/200), json.Unmarshal, parseError on failure
}
```

**Commit:** `feat(cli): API client UploadFile (streaming)`

### Task 4.2: `file` command

**Files:**
- Create: `cli/cmd/file.go`

```
agentdraft file <path> [--idempotency-key KEY] [--content-type MIME]
```

Behavior: reject a path over `MAX_FILE_BYTES` (100 MiB) locally before uploading (fail fast
with a clear message). Print `URL:`, `File:`, `Size:`, `Type:` lines; note idempotent
replay when applicable. This is the arbitrary-file analogue of `upload` — no validation, no
versioning, each run is a new URL.

Register in `init()` via `rootCmd.AddCommand(fileCmd)`.

**Step: verify** — `cd cli && go build ./... && go vet ./...` → clean.

**Commit:** `feat(cli): agentdraft file <path> command`

---

## Phase 5 — Dashboard (minimal)

### Task 5.1: Files list page

**Objective:** A read-only "Files" page listing the signed-in account's uploads (filename,
type, size, date, link, revoke). Mirror the existing drafts list route/loader pattern.

**Files:**
- Modify: `worker/src/routes/` — add `GET /api/files` list + `POST /api/files/:id/disable`
  (revoke/takedown) endpoints, `manage`/`upload` scoped as drafts are.
- Create: `dashboard/src/routes/files/+page.server.ts` + `+page.svelte`.

Keep it lean — this is parity, not a new surface. If time-boxed, ship list-only and defer
revoke to a follow-up (note it in the PR).

**Commit:** `feat(dashboard): files list page`

---

## Phase 6 — Skill (replace Theo's file-upload)

### Task 6.1: Write our file-upload skill

**Objective:** Replace the `files.tslop.org` skill with one that drives `agentdraft file`.
Install to `~/.hermes/skills/` (mirror into `webhost/skills/` for the repo).

**Files:**
- Create: `~/.hermes/skills/productivity/agentdraft-file-upload/SKILL.md`
- Create: `webhost/skills/agentdraft-file-upload/SKILL.md` (repo copy)

Content covers: when to use (screenshot, recording, log, PDF, archive, build artifact — any
binary a human or another agent needs by URL); `agentdraft file <path>` → public URL; auth
via `agentdraft auth set` (no env var); the 100 MB cap; the attachment-vs-inline behavior
(images/mp4/pdf preview in browser, everything else downloads); "published files are public
to anyone with the URL — no secrets"; include the URL in PR descriptions where relevant.
Distinguish from `agentdraft upload` (that renders reviewable HTML/MD documents; `file` is
for raw artifacts served as-is).

**Commit:** `docs(skill): agentdraft-file-upload replaces files.tslop.org`

---

## Phase 7 — Deploy + end-to-end verification

### Task 7.1: Apply remote migration + deploy both workers

```bash
export CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=b4fc0a2a9ebe835707306fb9c2d1b53f
cd worker && bunx wrangler d1 migrations apply agentdraft-db --remote
bunx wrangler deploy                      # agentdraft-api
cd ../content-worker && bunx wrangler deploy   # agentdraft-content
```

### Task 7.2: Real end-to-end proof (no fabrication)

With a real API key (`agentdraft auth set`), from the built CLI:

1. `agentdraft file /path/to/screenshot.png` → capture the URL.
2. `curl -sI <url>` → assert `content-disposition: inline`, `content-type: image/png`,
   `x-content-type-options: nosniff`, `cache-control: ...immutable`.
3. Upload a `.html` file → `curl -sI <url>` → assert `content-disposition: attachment`
   (the critical safety assertion — an HTML file must NOT serve inline).
4. Upload an `.svg` → assert `attachment` (svg is a script vector).
5. Upload an mp4 → `curl -sI -H 'Range: bytes=0-1023' <url>` → assert `206` +
   `content-range` + `accept-ranges: bytes`.
6. Re-run step 1 with `--idempotency-key k1` twice → second returns the SAME `file_id`,
   `idempotent_replay: true`.
7. Upload a >100 MB file → assert `413 E_TOO_LARGE` (local pre-check AND server guard).
8. Confirm the served bytes match the source: `curl -s <url> | sha256sum` vs
   `sha256sum <local>`.

Report the actual `curl -I` output. Do not claim pass without it.

### Task 7.3: PR

Branch `feat/file-uploads` → PR to `Tapetide-hq/agentdraft`. Title under 70 chars. Body:
summary, the security model (attachment-default + inline allowlist + nosniff), what was
tested (paste the real curl assertions), and the 100 MB cap rationale. CI green → merge
(per standing instruction, an explicit build+ship ask authorizes merge on green).

---

## Self-review checklist

- [ ] Upload streams (no `.arrayBuffer()`); >100 MB refused by BOTH local pre-check and the
      server stream guard.
- [ ] Every served file is `nosniff`; `attachment` is the default; inline is allowlist-only;
      `text/html` and `image/svg+xml` are NEVER inline (asserted by a test/curl).
- [ ] File ids and draft ids live in separate route namespaces (`/f/` vs `/d/`); no collision.
- [ ] `upload` scope required to write; reads are public by unguessable id.
- [ ] Range requests return 206; partials are NOT cached.
- [ ] Idempotency key dedupes retries (same `file_id`, no second object).
- [ ] Skill installed to `~/.hermes/skills/` AND mirrored in the repo.
- [ ] End-to-end verified with real curl output before claiming done.
