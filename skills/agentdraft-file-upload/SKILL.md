---
name: agentdraft-file-upload
description: Use when the user asks to upload a file, or one is needed for a PR description. Uploads any local file to our own Cloudflare-backed host and returns a public URL.
version: 1.0.0
author: Tapetide
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [agentdraft, file-upload, cli, hosting, handoff]
    related_skills: [agentdraft-publish-draft]
---

# File upload with agentdraft

Upload any local file — a screenshot, screen recording, log, document, PDF, config, build
artifact, or archive — to our own public file host and get back a public URL. This is our
in-house replacement for third-party file hosts: it runs on our Cloudflare account
(Workers + R2), so there is no external dependency and no per-file token to manage beyond
the agentdraft API key already used for publishing drafts.

## When to Use

- The user asks to upload a file and get a link
- A PR description, chat message, or ticket needs a URL to an artifact
- You produced a screenshot, recording, log, or archive a human must open in a browser
- You are on a remote box or CI runner the human cannot reach

Don't use for:

- HTML or Markdown you want rendered as a readable document — use `agentdraft upload`
  (the `agentdraft-publish-draft` skill) instead. That renders a formatted page; this
  serves raw bytes as-is.
- Source code changes — those belong in a commit and a PR.
- **Secrets, credentials, tokens, or customer PII. Uploaded files are public to anyone
  holding the URL.** There is no per-viewer access control.

## Upload in one command

```bash
agentdraft file screenshot.png
# URL:   https://agentdraft.tapetide.com/f/uth2010ia906sgastw4ree
# File:  uth2010ia906sgastw4ree
# Name:  screenshot.png
# Type:  image/png
# Size:  18244 bytes
```

Report the **URL** to the human, never a local path. Include it in GitHub descriptions
where relevant. Use only the base name of the file — the URL id is random, so names need
not be unique.

## What serves inline vs downloads

The host serves a strict allowlist **inline** (opens in the browser): PNG, JPEG, GIF,
WebP, AVIF, MP4, WebM, MP3, plain text, and PDF. **Everything else downloads** as an
attachment — that includes HTML, SVG, zips, and any unknown type. This is a deliberate
security property: an uploaded `.html` or `.svg` is never executed as a page on the host,
so a link is always safe to open. You cannot override it; it is decided by the file's type.

MP4/WebM support HTTP range requests, so recordings seek and stream in the browser.

## Retrying safely

Each `agentdraft file` run mints a **new** URL — files are not versioned (unlike drafts).
To make a retry idempotent so a network replay does not create a duplicate, pass a stable
key:

```bash
agentdraft file recording.mp4 --idempotency-key "run-$(git rev-parse HEAD)"
# A replay with the same key returns the SAME file and says so — no second upload.
```

Use this in any unattended loop (CI, cron, a retry wrapper).

## Overriding the content type

The server infers the MIME type from the extension or the bytes. Override it when the
extension is wrong or missing:

```bash
agentdraft file dump --content-type text/plain
```

## Authentication

Same credential as document publishing — one API key per machine:

```bash
agentdraft auth set "$KEY"   # non-interactive; verifies against the server
agentdraft whoami            # confirms account + scopes (needs the 'upload' scope)
```

Keys are created in the dashboard (Settings → API Keys). **There is no
`AGENTDRAFT_API_KEY` environment variable** — credentials come only from `auth set`,
stored at `~/.agentdraft/credentials.json` (`0600`). In CI, inject the key from your
secret store and run `auth set` as a setup step. If the key is unset, tell the user rather
than guessing.

## Constraints

| Limit | Value |
|---|---|
| Max file size | 100 MB (Cloudflare Free-plan request-body cap) |
| Directories | not accepted — zip a folder first |
| Empty files | rejected |
| Access control | none — public by unguessable URL |

`agentdraft file` exits **0** on success and **1** on any failure, so `&&` chaining and CI
gates behave correctly.

## Common Pitfalls

1. **Reporting a file path instead of the URL.** The whole point is a link the human can
   open. Always surface the `URL:` line.
2. **Using `file` for a document you want rendered.** A `.md` or `.html` you want read as a
   formatted page goes through `agentdraft upload`, not `agentdraft file` (which would
   force it to download).
3. **Assuming `AGENTDRAFT_API_KEY` works.** It does not exist. Run `auth set` first.
4. **Uploading secrets.** A URL holder is a reader. Scrub tokens, keys, internal
   hostnames, and customer data before uploading.
5. **Expecting a stable URL across re-uploads.** Files are not versioned — each upload is a
   new URL. Use `--idempotency-key` only to dedupe retries of the *same* upload.

## Verification Checklist

- [ ] `agentdraft whoami` shows the expected account and an `upload` scope before uploading
- [ ] Upload exited 0 and printed a `URL:` line
- [ ] Opened or `curl`ed the URL and confirmed it serves the intended file
- [ ] File contains no secrets, tokens, or customer data
- [ ] The URL — not a local path — is what you reported to the human
