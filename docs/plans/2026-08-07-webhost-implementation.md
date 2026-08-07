# WebHost Implementation Plan

**Goal:** Ship an open-source, Cloudflare-native service that lets AI agents publish
static HTML documents and get back a stable public URL, with versioning, a Go CLI, and
a dashboard.

**Architecture:** Two Workers on two ORIGINS. `webhost-api` serves the JSON API and the
SvelteKit dashboard. `webhost-content` serves untrusted user HTML from a separate
workers.dev origin so a CSP bypass in an uploaded document cannot reach a dashboard
session. D1 holds metadata, R2 holds HTML blobs, KV holds rate-limit counters.

**Tech Stack:** Hono + TypeScript (Workers), Cloudflare D1/R2/KV, SvelteKit +
adapter-cloudflare, Go 1.24 + cobra CLI, vitest + `go test`.

---

## Verified environment constraints (these SHAPE the plan)

| Constraint | Consequence |
|---|---|
| `webhost.dev` is NOT owned. Only `*.workers.dev` available. | All URLs are `*.workers.dev`. Custom domain documented, not configured. |
| Google OAuth client CANNOT be provisioned autonomously (needs interactive browser consent). | Google OAuth ships as a **dormant, config-gated** code path. The **primary, end-to-end-tested** auth is a CLI device-pairing flow + a bootstrap root key. |
| No email provider provisioned. | No magic-link auth. |
| CF account `b4fc0a2a9ebe835707306fb9c2d1b53f`, token scoped Workers+D1+R2+KV. | Resources created fresh; no sibling resources referenced. |

**Provisioned resources (created by this build, owned by this build):**
- D1 `webhost-db` = `6c8ca102-ac0b-4294-8f86-fccea354a1e5`
- R2 `webhost-html`
- KV `webhost-ratelimit` = `24362ce9d8584a209ebc781d6dc4af42`

---

## Deviations from the source plan, with reasons (Fusion-reviewed, key WEBHOST-CF-ARCH-9931)

Fusion's multi-model synthesis reviewed the five load-bearing decisions. Its verdict is
highest-weight and is folded here.

1. **Two Workers, two origins** (source plan had one Worker serving both API and user
   HTML). Serving attacker-controlled HTML same-origin with an authenticated dashboard
   is stored-XSS-to-account-takeover. Cookie `Path` scoping is NOT a boundary against
   same-origin JS — JS under `/d/*` can `fetch('/api/*')` and the browser attaches the
   cookie. Fusion confirmed: two origins is the *minimum correct* architecture.
2. **Auth: bootstrap-minted scoped API keys + dashboard paste→session.** Fusion
   corrected the device-pairing idea: pairing is circular without an IdP (the browser
   has no authenticated identity to confirm the pairing). A one-time `/bootstrap`
   (guarded by a Worker secret) mints the owner + first scoped key. The CLI uses bearer
   keys directly. The dashboard takes a pasted scoped key once at `POST /api/session`,
   verifies it, creates a random revocable D1 session, sets
   `__Host-webhost_session=…; Secure; HttpOnly; SameSite=Strict; Path=/`. Google OAuth
   remains a **schema/interface seam only** — NOT dead callback code. v1 is
   single-operator / invite-only by design; public enrollment is later work.
3. **Anonymous uploads: REMOVED from v1.** Fusion was unambiguous: 10/hr/IP + noindex +
   blocked forms does not stop targeted phishing, tracking, or takedown burden.
   Publishing requires a revocable key tied to an owner; public *reading* stays
   anonymous. No `anon_drafts` table.
4. **Validation: ONE authoritative server validator** (parse5 real HTML5 tree parser in
   the Worker). Fusion: two implementations + a shared corpus give *tested* parity, not
   *guaranteed* parity — drift stays structurally possible. The server is the only gate
   that matters. The CLI does transport-only pre-checks (size cap, UTF-8, empty) for
   fast feedback, submits the exact bytes, and displays the server's validation errors.
   The shared fixture corpus (`shared/html-policy-fixtures.json`) still drives the
   server validator's test suite. Never re-serialize the parsed tree — parse only to
   accept/reject, store original bytes byte-for-byte.
5. **Version allocation: counter column + `UPDATE … RETURNING`.**
   `UPDATE drafts SET last_allocated_version = last_allocated_version + 1 WHERE id=? AND account_id=? RETURNING last_allocated_version`
   is atomic and race-free; `UNIQUE(draft_id, version_number)` stays as a backstop.
   Ordering: (1) auth+authorize+quota+validate, (2) atomically allocate version (a later
   failure burns a number — gaps are fine), (3) R2 PUT the exact bytes, (4) D1 `batch()`
   inserting the `draft_versions` row AND advancing `published_version` via
   `MAX(published_version, new_version)` so out-of-order finishers can't move "latest"
   backward. Never create a public version row before the R2 PUT succeeds — a broken
   public row is worse than an invisible R2 orphan. Accept an `Idempotency-Key` header
   so agent retries don't duplicate versions.
6. **Viewer threat model (Fusion's "biggest miss").** Origin isolation protects the
   management account, not the human viewer. A byte-for-byte page can still impersonate
   a login screen, track via external images, or link to phishing. v1 decision: the
   product's purpose is publishing rich HTML, so external `https:` images and links are
   allowed by design, but every served page is explicitly treated as UNTRUSTED content
   (`SECURITY.md` documents this), carries `X-Robots-Tag: noindex`,
   `Referrer-Policy: no-referrer`, and a strict CSP. No sanitized-safe claim is made.

---

## Phase 0 — Repo skeleton
- Monorepo dirs, MIT LICENSE, root README, `.gitignore`, git identity check.
- Commit.

## Phase 1 — Shared HTML policy + both validators (TDD)
1. Write `shared/html-policy-fixtures.json`: ~60 cases, each `{id, html, expect_ok,
   expect_error_codes, note}`. Cover: allowed semantic HTML, inline `<style>`,
   `style=`, inline SVG, `https:`/`data:` images, `https:` links — and blocked:
   `<script>` (inline, src, type=module, nested-in-comment), `<iframe>`, `<object>`,
   `<embed>`, `<form>`, `<base>`, `<link>`, every `on*` handler, `javascript:` with
   entity/whitespace/newline/tab obfuscation, `vbscript:`, `file:`, `srcdoc`,
   `<meta http-equiv=refresh>`, CSS `expression()`/`behavior:`/`url(javascript:)`,
   `<svg><script>`, `<math><annotation-xml encoding="text/html">` mXSS,
   `<noscript>`/`<template>` parse differentials, oversize document.
2. Worker validator `worker/src/services/html-validator.ts` using a real tokenizer
   (`HTMLRewriter` is streaming-only and lossy for this; use `htmlparser2` compiled
   into the Worker bundle for exact token semantics). Test against the fixtures.
3. Go validator `cli/internal/validate/html.go` using `golang.org/x/net/html`
   tokenizer. Test against the SAME fixtures file.
4. Both suites green on the same corpus. Commit.

## Phase 2 — D1 schema + migrations
- `worker/migrations/0001_init.sql`: accounts, api_keys, projects, drafts,
  draft_versions, pairing_codes, sessions, abuse_reports, indexes.
- Anonymous-capable: `drafts.account_id` nullable for anon.
- Apply `--local` and `--remote`. Commit.

## Phase 3 — Worker API
- Hono router, `env.d.ts` bindings, error envelope, CORS for the dashboard origin.
- `middleware/auth.ts`: bearer key (SHA-256 domain-separated digest, single indexed
  lookup — NOT PBKDF2; Workers caps iterations at 100k and keys are 256-bit CSPRNG so
  stretching buys nothing) + signed session cookie.
- `middleware/ratelimit.ts`: KV counters, fixed window, per-IP and per-key.
- Routes: `/api/upload`, `/api/me`, `/api/api-keys`, `/api/projects`, `/api/drafts`,
  device pairing (`/api/auth/pair/*`), dormant `/api/auth/google`.
- Upload ordering: **R2 PUT first, then D1 INSERT.** An orphan R2 object is harmless
  garbage; a D1 row pointing at a missing R2 object is a 500 on a public URL.
- Commit per route group.

## Phase 4 — Content Worker (separate origin)
- `content-worker/`: `GET /d/:id`, `/d/:id/raw`, `/d/:id/v/:n`, `/d/:id/v/:n/raw`.
- Reads D1 + R2 directly (read-only bindings). Serves bytes verbatim.
- Headers: strict CSP, `X-Robots-Tag: noindex`, `Cross-Origin-Resource-Policy`,
  `X-Content-Type-Options: nosniff`, sandbox-equivalent CSP, Cache API for hot drafts.
- **No cookies, no auth, no Set-Cookie ever on this origin.**

## Phase 5 — Go CLI
- cobra: `auth login` (device pairing), `auth set`, `auth logout`, `whoami`, `upload`,
  `fetch`, `list`, `projects`, `config`, `version`.
- `~/.webhost/` at 0700, files 0600. Git metadata collection. Local draft mapping.
- Unit tests for validate/config/drafts/git. Cross-compile check.

## Phase 6 — SvelteKit dashboard
- Login via API key paste (works today) with the Google button rendered only when the
  server reports OAuth configured. Dashboard, projects, draft detail with version
  timeline, preview via an `<iframe sandbox>` pointed at the CONTENT origin, settings
  with key management, `/cli/auth` pairing-approval page.

## Phase 7 — Deploy + end-to-end verification
- `wrangler deploy` both Workers, apply remote migrations, mint bootstrap key.
- Real CLI binary → real deployed API → real public URL fetched with curl, bytes
  compared for equality. Probe unhappy paths (no key, bad key, wrong scheme, blocked
  HTML) and assert 4xx not 500. `wrangler tail` on any 500.

## Phase 8 — Open source polish
- CI (3 workflows), GoReleaser, install.sh, OpenAPI spec, docs/, CONTRIBUTING,
  SECURITY, CODE_OF_CONDUCT, issue/PR templates, Dependabot.
- Push to GitHub, open PR, address review bots, merge.

---

## Verification gates (nothing is "done" without these)
1. `bun run test` green in `worker/`, `go test ./...` green in `cli/`.
2. Both validators agree on 100% of the shared fixture corpus.
3. `bun run build` clean for worker, content-worker, dashboard.
4. Deployed: every route returns its expected status; blocked HTML returns 422 with
   error codes; a bad key returns 401 (a 500 there means auth itself is broken).
5. Byte-for-byte: `sha256(uploaded file) == sha256(curl of public URL)`.
6. `wrangler tail` shows no runtime exceptions during the probe sweep.
