<div align="center">

# agentdraft

**Publish AI-agent plans to stable, versioned review URLs — HTML and Markdown, one command.**

Open source by **[Tapetide](https://tapetide.com/)** · MIT licensed · runs on Cloudflare's free tier

[Quick start](#quick-start) · [How it works](#how-it-works) · [CLI](./docs/cli.md) · [API](./docs/api.md) · [Agent skills](./skills/) · [Security model](./SECURITY.md) · [Self-hosting](./docs/self-hosting.md)

</div>

---

## The problem

You are not running one coding agent any more. You are running a fleet.

One is on your laptop. One is on a remote box you SSH into. Two more run in CI. A
long-running one lives on a cloud VM you spun up last week. Every one of them produces
work you actually need to read — a migration plan, an architecture proposal, a security
audit, a refactor report.

And every one of them dumps that work somewhere you can't get to it:

- a `plan.md` sitting in `/tmp` on a machine you'd have to SSH into
- a wall of Markdown flattened into a chat window, asterisks and all
- a CI artifact that expires in seven days
- a file on a container that no longer exists

So you end up reading raw Markdown in a terminal, or copy-pasting into a gist, or asking
the agent to summarise the thing it already wrote. The plan was fine. **Getting to it was
the problem.**

`agentdraft` gives every agent, on every machine, one command that returns a URL a human
can open in a browser:

```bash
agentdraft upload plan.md
# → https://agentdraft.tapetide.com/d/a1b2c3d4e5f6
```

Markdown is rendered into a readable document. HTML is served byte-for-byte. Every
re-upload of the same file is a new immutable version, and the old ones stay live. One
place for every agent's output, wherever it ran.

## Quick start

Install the CLI (single Go binary, no runtime):

```bash
curl -fsSL https://raw.githubusercontent.com/Tapetide-hq/agentdraft/main/cli/install.sh | sh
```

Authenticate once per machine, then publish:

```bash
agentdraft auth set ad_your_key      # create a key in the dashboard
agentdraft upload plan.md            # Markdown → rendered for reading
agentdraft upload report.html        # HTML → served byte-for-byte
agentdraft list                      # everything you've published
agentdraft fetch <url> -o plan.md    # another agent reads it back
```

Point your agent at that command and you are done. There is no build step, no framework,
and nothing to deploy per document.

## How it works

```
  Go CLI ───HTTPS──▶  api.agentdraft.tapetide.com     (API, authenticated)
  Dashboard ───────▶        │            │
                            │            │
                      ┌─────▼───┐   ┌────▼──┐
                      │   D1    │   │  R2   │
                      │metadata │   │ blobs │
                      └─────▲───┘   └────▲──┘
                            │            │
  Browser ─────────▶  agentdraft.tapetide.com         (documents, NO cookies)
```

| Component | Tech | Role |
|---|---|---|
| `worker/` | Hono + TypeScript on Cloudflare Workers | API, auth, validation, Markdown rendering |
| `content-worker/` | TypeScript on Workers | Public document serving, isolated origin |
| `dashboard/` | SvelteKit on Workers | Projects, version history, API keys |
| `cli/` | Go + cobra | `upload`, `fetch`, `list`, `auth` |
| D1 / R2 / KV | Cloudflare | metadata / document blobs / rate limits |

### Publish HTML or Markdown from the command line

Send either. A `.md` file is rendered **once at upload** into a self-contained HTML
document — served at `/d/:id` so a human reads formatted prose, while the exact source
bytes stay retrievable at `/d/:id/raw` as `text/markdown`. Rendering at request time
would let a renderer upgrade silently change an already-published document, so it doesn't
happen.

### Immutable document versioning

Every upload to the same draft allocates a new version number atomically. `/d/:id` serves
the latest; `/d/:id/v/3` serves version 3 forever, cached for a year. Identical bytes are
deduplicated — the same content re-uploaded stores no second copy but still records a new
version, so history and git metadata stay accurate.

### Share agent output for human review

The CLI records which draft a local file maps to, so re-running `upload` on the same file
updates the same URL instead of littering new ones. Git branch, commit SHA and dirty
state are captured automatically when you publish from inside a repository.

### Security model for untrusted HTML

Uploaded documents are treated as hostile, because they are:

- **One authoritative validator.** A real HTML5 parser (parse5) rejects `<script>`,
  `<iframe>`, `<form>`, event handlers, `javascript:` URLs, mXSS namespace tricks and
  `<template>`/`<noscript>` parse-differential smuggling — enforced against a shared
  ~60-case conformance corpus. The CLI does fast transport pre-checks only; two
  independent validators would drift, one authority cannot.
- **Markdown rendering is not sanitising.** Markdown permits raw HTML passthrough, so
  rendered output goes through the *same* validator. A `.md` file containing `<script>`
  is rejected.
- **Separate origin, always.** Documents are served from an origin that never holds a
  session cookie, so a CSP bypass in a published page cannot reach a dashboard session.
- **Invite-only publishing.** Scoped, revocable API keys; no anonymous uploads by design,
  so this cannot become a free phishing host. Reading is anonymous.

Full threat model: [SECURITY.md](./SECURITY.md).

## Deploy agentdraft on Cloudflare Workers

Self-hosting takes about ten minutes and costs **$0/month** at hobby scale (Workers,
D1, R2 and KV free tiers). Full walkthrough: [docs/self-hosting.md](./docs/self-hosting.md).

```bash
git clone https://github.com/Tapetide-hq/agentdraft.git && cd agentdraft
wrangler d1 create agentdraft-db
wrangler r2 bucket create agentdraft-html
wrangler kv namespace create agentdraft-ratelimit
# put the ids in worker/wrangler.jsonc, then:
cd worker && bun install && wrangler d1 migrations apply agentdraft-db --remote && bun run deploy
```

## Testing

```bash
cd worker && bun run test        # 60-case HTML policy conformance corpus
cd cli    && go test ./...       # CLI unit tests

# adversarial end-to-end suite, against a real deployment
API=https://api.agentdraft.tapetide.com \
CONTENT=https://agentdraft.tapetide.com \
KEY=ad_your_key ./tests/brutal.sh
```

`tests/brutal.sh` runs **198 assertions**: XSS and policy-bypass attempts, auth bypass,
privilege escalation, IDOR, malformed input, injection, size limits, versioning, dedup,
idempotency, conditional requests on cold *and* warm cache, Markdown rendering and
hostile-Markdown rejection, cache-leak-after-delete, and concurrent-upload races. It needs
~80 uploads against a 100/hour limit, so use a fresh key per run.

## Documentation

| Doc | Contents |
|---|---|
| [docs/cli.md](./docs/cli.md) | Every command and flag |
| [docs/api.md](./docs/api.md) | HTTP API reference |
| [docs/architecture.md](./docs/architecture.md) | Design decisions and request flows |
| [docs/self-hosting.md](./docs/self-hosting.md) | Deploy your own instance |
| [docs/openapi.yaml](./docs/openapi.yaml) | Machine-readable API spec |
| [SECURITY.md](./SECURITY.md) | Threat model, validation policy, reporting |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Dev setup and PR guidelines |

## FAQ

**Is this web hosting?** No. It publishes agent-generated documents for review. There is
no domain, DNS, database or server for you to manage per document.

**Can I use it for a static site?** It's not built for that. Documents are `noindex` by
design and every page is treated as untrusted content.

**Are published URLs private?** They are unguessable but public — anyone with the link can
read it, and links are not search-indexed. Treat them as shareable, not secret.

**Does it work offline / self-hosted?** Yes, that's the intended deployment. Bring your
own Cloudflare account.

---

<div align="center">

Open source by **[Tapetide](https://tapetide.com/)** — AI-first stock research.

[MIT](./LICENSE)

</div>
