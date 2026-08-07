# WebHost

> Publish static HTML and get a stable public URL — instantly, no build step.
> Built for AI agents, CI pipelines, and developers. Cloudflare-native. MIT.

WebHost lets an agent generate an HTML document (a plan, a proposal, a report),
upload it with one command, and get back a public URL a human can open in a
browser. Every upload to the same draft creates a new immutable version; old
versions stay accessible.

```bash
webhost upload plan.html --project "migration"
# → https://postplan.tapetide.com/d/a1b2c3d4e5f6
```

## Why it's shaped this way

- **Two origins, always.** The API + dashboard live on one Worker origin; user
  HTML is served from a *separate* origin (`webhost-content`) that never holds a
  session cookie. Uploaded HTML is untrusted, and a same-origin XSS in a
  published page must not reach a dashboard session. This is the single most
  important design decision in the project.
- **Server is the only validation authority.** HTML is validated by one parser
  (parse5) in the Worker. The CLI does fast transport pre-checks (size, UTF-8)
  but never claims a document is safe — it submits the exact bytes and shows the
  server's verdict. Two independent validators would drift; one authority can't.
- **Byte-for-byte serving.** What you upload is what every visitor receives. No
  wrapper, no interstitial, no re-serialization.
- **Every published page is untrusted content.** See [SECURITY.md](./SECURITY.md).

## Reference deployment

| Surface | URL |
|---|---|
| Published documents | `https://postplan.tapetide.com/d/:id` |
| API | `https://api.postplan.tapetide.com` |
| Dashboard | `https://app.postplan.tapetide.com` |

## Architecture

```
  Go CLI ───HTTPS──▶  api.postplan.tapetide.com        (API, authed)
  Dashboard ────────▶      │            │
                           │            │
                      ┌─────▼───┐   ┌────▼──┐
                      │   D1    │   │  R2   │
                      │metadata │   │ HTML  │
                      └─────▲───┘   └────▲──┘
                           │            │
  Browser ──────────▶  postplan.tapetide.com             (serve HTML, NO cookies)
```

| Component | Tech | Purpose |
|---|---|---|
| `worker/` | Hono + TypeScript on Workers | API, auth, uploads, dashboard host |
| `content-worker/` | TypeScript on Workers | Public HTML serving, isolated origin |
| `cli/` | Go + cobra | `upload`, `fetch`, `list`, `auth`, `whoami` |
| `dashboard/` | SvelteKit on Workers Static Assets | Human UI: projects, versions, keys |
| D1 | Cloudflare D1 (SQLite) | accounts, keys, projects, drafts, versions, sessions |
| R2 | Cloudflare R2 | HTML blobs |
| KV | Cloudflare KV | rate-limit counters |

## Quick start (self-hosting)

See [docs/self-hosting.md](./docs/self-hosting.md) for the full guide. In short:

```bash
git clone https://github.com/Hitesh-Sisara/webhost.git && cd webhost
wrangler d1 create webhost-db          # put the id in worker/wrangler.jsonc
wrangler r2 bucket create webhost-html
wrangler kv namespace create webhost-ratelimit
wrangler d1 migrations apply webhost-db --remote
cd worker && bun install && bun run deploy
cd ../content-worker && bun install && bun run deploy
cd ../cli && go build -o webhost .
```

## Testing

Unit/conformance suites run per component (`bun run test` in `worker/`,
`go test ./...` in `cli/`). The adversarial end-to-end suite runs against a real
deployment:

```bash
API=https://api.postplan.tapetide.com \
CONTENT=https://postplan.tapetide.com \
KEY=wh_your_key ./tests/brutal.sh
```

174 assertions covering XSS/policy bypass attempts, auth and privilege escalation,
IDOR, malformed input, injection, size limits, versioning/dedup/idempotency,
conditional requests on cold *and* warm cache, method hygiene, cache-leak-after-delete,
and concurrent-upload races. It needs ~70 uploads and the API allows 100/hour per key,
so use a fresh key per run (the suite fails fast with instructions if the budget is
already spent).

## Documentation

- [docs/api.md](./docs/api.md) — API reference
- [docs/cli.md](./docs/cli.md) — CLI reference
- [docs/architecture.md](./docs/architecture.md) — design decisions
- [docs/self-hosting.md](./docs/self-hosting.md) — deploy your own
- [SECURITY.md](./SECURITY.md) — threat model and reporting

## License

MIT — see [LICENSE](./LICENSE).
