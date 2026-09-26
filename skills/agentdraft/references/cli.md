# agentdraft CLI reference

Verified against `agentdraft 0.2.0 --help` output. If a flag is not listed here, it does
not exist — do not invent one.

State lives in `~/.agentdraft/` (dir `0700`, files `0600`):

| File | Purpose |
|---|---|
| `config.json` | `{ "api_url": "https://api.agentdraft.tapetide.com" }` — change with `agentdraft config --api-url` for a self-hosted instance |
| `credentials.json` | `{ "api_key": "ad_…", "account_id": "acct_…" }` — written by `auth set` / `auth login` |
| `drafts.json` | absolute file path → draft id, so re-uploading the same path updates the same draft |

## Install

```bash
# Release binary (linux/darwin, amd64/arm64). Verifies SHA-256 against checksums.txt.
curl -fsSL https://raw.githubusercontent.com/Tapetide-hq/agentdraft/main/cli/install.sh | sh
# Env overrides: AGENTDRAFT_INSTALL_DIR (default ~/.local/bin), AGENTDRAFT_VERSION (e.g. v0.2.0)

# From source (Go 1.24+); builds the current main branch
go install github.com/Tapetide-hq/agentdraft/cli@latest
```

Windows: download the `.zip` from https://github.com/Tapetide-hq/agentdraft/releases.

## Commands

### `agentdraft auth`

```
agentdraft auth set <api-key>   Store a key non-interactively. Verified against the server before saving.
agentdraft auth login           Interactive: paste a key at the prompt. Same result as `set`.
agentdraft auth logout          Delete credentials.json.
```

### `agentdraft whoami`

Prints `Account`, `ID`, `Email` (if any), `Auth` (key or session), `Scopes`, and
`New drafts: public|private` (the account default applied to newly created drafts).
Exit 1 with `not authenticated` when no key is stored.

### `agentdraft upload <file>`

Upload one HTML or Markdown file. Creates a draft, or updates the draft this path was
last uploaded to.

```
--project <name|proj_id>   Assign to a project. A name that does not exist is created.
--draft <id>               Force-update this draft id (ignores the path mapping).
--new                      Always create a new draft (and repoint the path mapping to it).
--title <text>             Override the title extracted from <title> / first heading.
--description <text>       Short label shown in lists.
--idempotency-key <k>      Same key → same version on replay; prints "(idempotent replay …)".
--private                  Create the draft owner-only. Only applies on CREATE.
--public                   Create the draft readable by URL. Only applies on CREATE.
```

`--private` and `--public` are mutually exclusive. Neither changes an existing draft.

Output (stdout):

```
URL:     https://agentdraft.tapetide.com/d/<id>
Draft:   <id>
Version: <n>
Title:   <title>
```

Server warnings go to stderr as `warning: <message> (<code>)`. Local pre-check refuses
empty, non-UTF-8, and >2 MiB files before any network call.

### `agentdraft file <path>`

Upload any single file as raw bytes; returns a fresh public URL each time.

```
--content-type <mime>      Override the MIME type sent (server infers from extension otherwise).
--idempotency-key <k>      A replay returns the SAME file instead of uploading again.
```

Refuses directories, empty files, and files over 100 MiB before uploading. Output:

```
URL:   https://agentdraft.tapetide.com/f/<id>
File:  <id>
Name:  <basename>
Type:  <mime>
Size:  <bytes> bytes
```

### `agentdraft fetch <url|draft-id>`

Download a draft's source bytes (Markdown for `.md` drafts, HTML otherwise) to stdout.

```
-o, --output <file>   Write to a file (prints "Wrote N bytes to <file>" on stderr).
--version <n>         A specific version instead of the latest.
```

Accepts a full content URL or a bare draft id (content host is derived from the
configured API URL). Public drafts need no credentials. For a private draft you own, the
stored key is used through the API; without a key the command exits 1 and writes nothing.

### `agentdraft list`

```
--project <proj_id>   Filter by project id (id only, not name).
--json                JSON array of drafts.
--limit <n>           Max results (default 100).
```

Table columns: `DRAFT ID  VER  VISIBILITY  TITLE  URL`. JSON fields per draft: `id`,
`project_id`, `title`, `description`, `published_version`, `public_url`, `updated_at`,
`is_public` (0 or 1).

### `agentdraft projects`

Lists projects (`PROJECT ID  NAME  DESCRIPTION`). `--json` for machine output.

### `agentdraft visibility <public|private> [draft-id|url|file]`

```
--all       Apply to EVERY existing draft in the account. Prints how many changed.
--default   Set the default for NEW drafts only. Existing drafts are untouched.
```

The target may be a draft id, a full content URL, or a local file path that was uploaded
before (resolved via `drafts.json`). `--all` and `--default` are mutually exclusive.

### `agentdraft config`

```
agentdraft config                   Print api_url.
agentdraft config --api-url <url>   Point the CLI at another (self-hosted) instance.
```

### `agentdraft completion <bash|zsh|fish|powershell>`

Prints a shell completion script.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (including an idempotent replay) |
| 1 | Any failure: pre-check, auth, network, server rejection. Message on stderr as `error: …` |

## URL shapes

| URL | Serves |
|---|---|
| `https://agentdraft.tapetide.com/d/<id>` | Latest version, rendered |
| `…/d/<id>/raw` | Latest version's exact source bytes (`text/markdown` for Markdown drafts) |
| `…/d/<id>/v/<n>` and `…/d/<id>/v/<n>/raw` | A specific immutable version, cached for a year |
| `https://agentdraft.tapetide.com/f/<id>` | A file upload (inline or attachment by MIME type) |
