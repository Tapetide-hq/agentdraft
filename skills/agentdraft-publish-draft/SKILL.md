---
name: agentdraft-publish-draft
description: Use when a human needs to read agent output in a browser. Publishes plans, proposals, reports, and audits to stable versioned URLs via the agentdraft CLI.
version: 1.0.0
author: Tapetide
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [agentdraft, publishing, review, cli, handoff]
    related_skills: []
---

# Publishing Drafts with agentdraft

## Overview

You produce work a human needs to read — a migration plan, an architecture proposal, a
security audit, a refactor report. That work is useless if it lands in `/tmp` on a box
nobody can reach, or gets flattened into a chat window, or expires as a CI artifact.

`agentdraft upload <file>` returns a URL a human opens in a browser. One command, no build
step. Every re-upload of the same file becomes a **new immutable version** at the **same
stable URL**, so a reviewer's link never goes stale and earlier versions stay readable.

## When to Use

- You wrote a plan, proposal, report, or audit that a human must review before you proceed
- You need a durable link to hand off: a PR comment, a chat message, a ticket
- You are on a machine the human cannot reach (remote box, CI runner, ephemeral container)
- You are iterating on a document and want the reviewer's link to keep working

Don't use for:

- Source code changes — those belong in a commit and a PR
- Secrets, credentials, tokens, or customer PII. **Published drafts are public to anyone
  holding the URL.** There is no per-viewer access control.
- Anything needing JavaScript. Scripts are rejected (see Constraints).

## Publish in one command

```bash
agentdraft upload plan.md
# URL:     https://agentdraft.tapetide.com/d/6146mnh523xb
# Draft:   6146mnh523xb
# Version: 1
# Title:   Agent Plan
```

Markdown (`.md`, `.markdown`, `.mdown`, `.mkd`) is rendered server-side for browser
reading; the exact source stays retrievable. HTML is served byte-for-byte. Give the file a
real `# Heading` or `<title>` — that becomes the draft title the human sees in a list.

Report the **URL** to the human. Never report only a local path.

## Updating: the same path updates the same draft

The CLI maps each absolute file path to a draft id in `~/.agentdraft/drafts.json`. Re-upload
the same path and it becomes the next version at the same URL:

```bash
agentdraft upload plan.md      # Version: 1
# ...revise the file...
agentdraft upload plan.md      # Version: 2  — same URL
```

The stable `/d/<id>` URL always serves the latest version, and `/d/<id>/v/1` still serves
the first. Consequences worth internalising:

- **Revising a document?** Upload the same path. Do not create a second draft — that
  strands the reviewer on a dead link.
- **Genuinely different document?** Use `--new`, or the mapping will overwrite an unrelated
  draft that happened to use the same filename.
- **Fresh clone or different machine?** `drafts.json` is local, so the mapping is gone and
  an upload creates a *new* draft. Pass `--draft <id>` to target the existing one.

```bash
agentdraft upload report.md --new              # always a new draft
agentdraft upload report.md --draft 6146mnh523xb   # force-update a known draft
```

**`--new` rewrites the mapping.** After `--new`, that path points at the *new* draft, so
the next plain `upload` of the same path updates the new one and the previous draft is
orphaned — still live at its URL, but no longer reachable by uploading that file. Verified:
uploading one path twice with `--new` produced drafts A then B, and a following plain upload
hit B. If you need to keep updating A, record its id and pass `--draft A`.

## Retrying safely

Network retries must not create duplicate versions. Pass a stable `--idempotency-key`; a
replay returns the same version and says so:

```bash
agentdraft upload plan.md --idempotency-key "deploy-plan-$(git rev-parse HEAD)"
# Version: 3
# (idempotent replay — no new version created)
```

Use this in any unattended loop — CI, cron, a retry wrapper.

## Grouping and reading back

```bash
agentdraft upload plan.md --project migration-q3   # created if the name is new
agentdraft projects
agentdraft list --json --limit 20                  # machine-readable
```

Read a draft back — how one agent consumes another's plan, no auth needed:

```bash
agentdraft fetch 6146mnh523xb              # latest, to stdout
agentdraft fetch 6146mnh523xb --version 1  # a specific earlier version
agentdraft fetch <url> -o plan.md
```

## Authentication

```bash
agentdraft auth set "$KEY"   # non-interactive; verifies against the server
agentdraft whoami            # confirms account + scopes
```

Keys are created in the dashboard (Settings → API Keys). **There is no
`AGENTDRAFT_API_KEY` environment variable** — credentials come only from `auth set` or
`auth login`, stored at `~/.agentdraft/credentials.json` (`0600`). In CI, inject the key
from your secret store and run `auth set` as a setup step:

```bash
agentdraft auth set "$AGENTDRAFT_KEY" && agentdraft upload plan.md
```

Keys are **publish-only**: they upload and read but cannot mint further keys, so a key
leaked from CI config cannot take over the account. Use one key per machine so revoking
one leaves the others working.

## Constraints: what will be rejected

Uploaded documents are served from an isolated origin and validated conservatively. Common
rejections, with the stable error code the CLI prints:

| Code | Cause |
|---|---|
| `E_SCRIPT` | any `<script>` element |
| `E_EVENT_HANDLER` | any `on*` attribute (`onclick`, …) |
| `E_FORM` | `<form>`, `<input>`, `<textarea>`, `<select>` |
| `E_FRAME` | `<iframe>`, `<frame>`, `<portal>` |
| `E_LINK` | `<link>` — so **no external stylesheets** |
| `E_DANGEROUS_URL` | `javascript:`, `data:text/html`, `file:` in a URL attribute |
| `E_DANGEROUS_CSS` | CSS `expression()`, `behavior:`, `@import` |
| `E_TOO_LARGE` | over 2 MiB (bytes, not characters) |
| `E_ENCODING` | not valid UTF-8, or a declared non-UTF-8 charset |

Allowed and sufficient for a good-looking document: all semantic HTML, **inline `<style>`
blocks and `style=` attributes**, `<img>` with `https:` or `data:image/*`, `<a href>` to
`https:`/`mailto:`/fragments, inline SVG, and tables. So style with an inline `<style>`
block — never a `<link>` to a CDN, and never a charting library.

`agentdraft upload` exits **0** on success and **1** on any rejection, so `&&` chaining and
CI gates behave correctly. The server is authoritative: a local pre-check only catches
empty, oversize, and non-UTF-8 files to save a round trip.

## Common Pitfalls

1. **Reporting a file path instead of the URL.** The whole point is a link the human can
   open. Always surface the `URL:` line.
2. **Creating a new draft for a revision.** Upload the same path. A reviewer holding the
   old link must see your update, not a stale v1.
3. **Assuming `AGENTDRAFT_API_KEY` works.** It does not exist. Run `auth set` first;
   otherwise every command fails `E_UNAUTHENTICATED`.
4. **Expecting the path mapping to survive.** `drafts.json` is per-machine and per-`$HOME`.
   In a fresh container, pass `--draft <id>` or you will silently fork the document.
5. **Styling with an external stylesheet.** `<link>` is `E_LINK`. Inline `<style>` instead.
6. **Retrying without an idempotency key.** Every retry becomes a new version, and version
   history stops meaning anything. An upload with *unchanged* content still creates a new
   version — the server does not dedupe by content hash, only by idempotency key.
7. **Publishing secrets.** A URL holder is a reader. Scrub tokens, keys, internal
   hostnames, and customer data before uploading.
8. **Reusing one key everywhere.** One key per machine; revocation then stays surgical.

## Verification Checklist

- [ ] `agentdraft whoami` shows the expected account before uploading
- [ ] Upload exited 0 and printed a `URL:` line
- [ ] For a revision: `Version:` incremented and the URL is **unchanged** from last time
- [ ] Opened or `fetch`ed the URL and confirmed it serves the intended content
- [ ] Document contains no secrets, tokens, or customer data
- [ ] The URL — not a local path — is what you reported to the human
