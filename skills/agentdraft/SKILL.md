---
name: agentdraft
description: Publish agent-written documents (plans, proposals, reports, audits — Markdown or HTML) to a stable, versioned review URL, or upload any file (screenshot, recording, log, PDF, archive) to a public URL, using the agentdraft CLI. Use whenever a human must read your output in a browser, a PR / ticket / chat message needs a link to an artifact, you are on a machine the human cannot reach (remote box, CI, container), or another agent must read a draft back. Do not use for source code changes (commit + PR) or for anything containing secrets or customer data.
license: MIT
metadata:
  author: Tapetide
  version: 2.0.0
  homepage: https://github.com/Tapetide-hq/agentdraft
  hermes:
    tags: [agentdraft, publishing, file-upload, review, cli, handoff]
---

# agentdraft — publish output a human can open

You produce work a human needs to read. Raw Markdown in a terminal, a `/tmp` path on a
box nobody can reach, or a CI artifact that expires is not a handoff. `agentdraft` turns
a local file into a URL in one command, with no build step.

Two lanes, one credential:

| You have | Command | What the human gets |
|---|---|---|
| `.md` / `.html` a human should **read** | `agentdraft upload <file>` | Rendered document at a **stable, versioned** URL |
| Any other file (PNG, MP4, log, PDF, zip …) | `agentdraft file <path>` | Raw bytes at a fresh public URL |

**Always report the `URL:` line to the human, never a local path.**

## Before the first command

```bash
command -v agentdraft || curl -fsSL https://raw.githubusercontent.com/Tapetide-hq/agentdraft/main/cli/install.sh | sh
agentdraft whoami          # exit 0 → authenticated; shows account, scopes, and the visibility default for NEW drafts
```

If `whoami` fails with `not authenticated`, stop and ask the human for an API key
(created in the dashboard under Settings → API Keys), then:

```bash
agentdraft auth set "$KEY"   # verifies against the server, stores at ~/.agentdraft/credentials.json (0600)
```

**There is no `AGENTDRAFT_API_KEY` environment variable.** Credentials come only from
`auth set` / `auth login`. In CI, inject the key from the secret store and run `auth set`
as a setup step. Never guess or fabricate a key.

## Publish a document

```bash
agentdraft upload plan.md
# URL:     https://agentdraft.tapetide.com/d/6146mnh523xb
# Draft:   6146mnh523xb
# Version: 1
# Title:   Migration plan
```

- Markdown (`.md`, `.markdown`, `.mdown`, `.mkd`) is rendered server-side into a readable
  page; the exact source stays at `<url>/raw`. HTML is served byte-for-byte.
- Give the file a real `# Heading` or `<title>`; that becomes the title the human sees.
- Style HTML with an inline `<style>` block. `<link>` to an external stylesheet, any
  `<script>`, and any charting library are rejected (see Constraints).
- Group related documents: `--project <name>` (created if the name is new).

### Revising: same path → same URL, new version

The CLI maps each **absolute file path** to a draft id in `~/.agentdraft/drafts.json`.
Re-upload the same path and the reviewer's link now shows the new content; every earlier
version stays live at `<url>/v/<n>`.

```bash
agentdraft upload plan.md      # Version: 1
# ...edit...
agentdraft upload plan.md      # Version: 2 — SAME URL
```

Rules that follow from this:

- **Revising?** Upload the same path. Do not create a second draft — that strands the
  reviewer on a stale link.
- **Genuinely different document with the same filename?** `--new`. Note `--new` rewrites
  the mapping, so the old draft stays live but is no longer reachable by uploading that path.
- **Fresh clone, new container, different `$HOME`?** The mapping is gone and a plain upload
  forks the document. Pass `--draft <id>` to target the known draft.
- **Unattended retries** (CI, cron, retry wrapper): pass `--idempotency-key "<stable key>"`.
  A replay returns the same version and prints `(idempotent replay — no new version created)`.
  Without it every retry, even with unchanged bytes, is a new version.

### Visibility

Drafts are public-by-URL unless the account default says otherwise. `whoami` prints
`New drafts: public` or `New drafts: private`, so check it before you promise a reviewer
they can open the link without signing in.

```bash
agentdraft upload plan.md --private      # this NEW draft is owner-only (URL unchanged, others see sign-in)
agentdraft upload plan.md --public       # this NEW draft is readable by anyone with the URL
agentdraft visibility private plan.md    # flip an EXISTING draft (accepts a file path, draft id, or URL)
agentdraft visibility private --default  # default for NEW drafts only
agentdraft visibility public --all       # every existing draft; reports how many actually changed
```

`--private` / `--public` on `upload` apply only when the draft is **created**. Re-uploading
never changes visibility; use `visibility` for that.

## Upload any file

```bash
agentdraft file screenshot.png
# URL:   https://agentdraft.tapetide.com/f/uth2010ia906sgastw4ree
# Type:  image/png
# Size:  18244 bytes
```

- Served **inline** (opens in the browser) only for PNG, JPEG, GIF, WebP, AVIF, MP4, WebM,
  MP3/M4A, plain text, and PDF. **Everything else downloads**, including HTML, SVG, and
  zips. This is deliberate and cannot be overridden: an uploaded `.html` never executes on
  the host.
- Files are **not versioned**: each run mints a new URL. Use `--idempotency-key` only to
  make a retry of the *same* upload safe.
- `--content-type <mime>` when the extension is missing or wrong.
- Directories are refused — zip first. Limit 100 MB.
- Files are **always public** to anyone holding the URL. There is no private mode for files.

## Read a draft back (agent-to-agent)

```bash
agentdraft fetch 6146mnh523xb              # latest, to stdout (Markdown drafts return the Markdown source)
agentdraft fetch 6146mnh523xb --version 1  # a specific version
agentdraft fetch <url> -o plan.md
agentdraft list --json --limit 20          # everything you have published, machine-readable
```

Public drafts need no credentials. Private drafts are fetched through the authenticated
API when you own them; the CLI never follows the sign-in redirect, so you cannot
accidentally save a login page as "the document".

## Constraints: what the server rejects

The server is the single authority; the CLI prints its error code verbatim and exits 1.

| Code | Cause |
|---|---|
| `E_SCRIPT` | any `<script>` |
| `E_EVENT_HANDLER` | any `on*=` attribute |
| `E_LINK` | `<link>` — so no external stylesheets or fonts |
| `E_FORM` / `E_FRAME` / `E_PLUGIN` | forms and inputs / iframes and frames / object, embed, applet |
| `E_DANGEROUS_URL` | `javascript:`, `data:text/html`, `file:` in a URL attribute |
| `E_DANGEROUS_CSS` | CSS `expression()`, `behavior:`, `@import` |
| `E_META_REFRESH` / `E_BASE` / `E_SRCDOC` | redirects, `<base>`, `srcdoc` |
| `E_TOO_LARGE` | HTML over 2 MiB, Markdown source over 1 MiB, file over 100 MB |
| `E_ENCODING` | not valid UTF-8 |
| `E_UNAUTHENTICATED` | no or invalid key — run `auth set` |
| `E_RATE_LIMITED` | upload budget exhausted for this window; wait, do not loop |

Allowed and sufficient: all semantic HTML, inline `<style>` and `style=`, `<img>` with
`https:` or `data:image/*`, `<a href>` to `https:` / `mailto:` / `#fragment`, inline SVG,
tables. Markdown with raw HTML goes through the **same** validator, so `<script>` inside a
`.md` is also rejected. Full list: [references/errors.md](references/errors.md).

Exit codes: **0** success, **1** any failure — safe for `&&` chains and CI gates.

## Pitfalls

1. **Reporting a path instead of the URL.** Surface the `URL:` line, every time.
2. **Creating a new draft for a revision.** Same path, same URL. `--new` only for a
   genuinely different document.
3. **Assuming an env var for the key.** `AGENTDRAFT_API_KEY` does not exist. `auth set`.
4. **Trusting the path mapping across machines.** In a fresh environment pass `--draft <id>`.
5. **Using `file` for a document.** A `.md`/`.html` you want *read* goes through `upload`;
   `file` would force it to download.
6. **Using `upload` for a binary.** It only accepts UTF-8 text; use `file`.
7. **External stylesheet or JS.** `E_LINK` / `E_SCRIPT`. Inline `<style>` only, no charts
   from a CDN.
8. **Retrying without an idempotency key** in unattended loops.
9. **Promising a public link when the account default is private.** Check `whoami`, or
   pass `--public` explicitly.
10. **Publishing secrets.** A URL holder is a reader. Scrub tokens, keys, internal
    hostnames, and customer data first. Files are public, always.

## Verification checklist

- [ ] `agentdraft whoami` exits 0 and shows the expected account
- [ ] Command exited 0 and printed a `URL:` line
- [ ] For a revision: `Version:` incremented and the URL is unchanged
- [ ] Visibility matches what you told the human (`whoami` default, `--public`/`--private`, or `list`)
- [ ] `agentdraft fetch <url>` or `curl -I <url>` returns the intended content
- [ ] No secrets, tokens, or customer data in the content
- [ ] The URL, not a local path, is in your report

## Additional resources

- Every command and flag, verified against `agentdraft --help`: [references/cli.md](references/cli.md)
- Every server error code and what to do about it: [references/errors.md](references/errors.md)
- Project, API docs, and self-hosting: https://github.com/Tapetide-hq/agentdraft
