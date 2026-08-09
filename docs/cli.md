# CLI Reference

The `agentdraft` CLI is a single Go binary with no runtime dependencies.

## Install

```bash
# From source (requires Go 1.24+)
go install github.com/Tapetide-hq/agentdraft/cli@latest

# Or download a release binary
curl -fsSL https://raw.githubusercontent.com/Tapetide-hq/agentdraft/main/cli/install.sh | sh
```

## Configuration

State lives in `~/.agentdraft/` (dir `0700`, files `0600`):

- `config.json` — `{ "api_url": "https://api.agentdraft.tapetide.com" }`
- `credentials.json` — `{ "api_key": "ad_…", "account_id": "acct_…" }`
- `drafts.json` — maps local file paths to draft IDs so re-uploads update the same draft

## Commands

### `agentdraft auth`
```
agentdraft auth login          Interactive: paste an API key (verified server-side)
agentdraft auth set <key>      Store an API key non-interactively (verified server-side)
agentdraft auth logout         Remove stored credentials
```

### `agentdraft whoami`
Prints the current account, auth method, and scopes.

### `agentdraft upload <file>`
Upload an HTML **or Markdown** file. A `.md` file is rendered server-side for browser
reading, with the exact source retrievable at `/raw`. Creates a new draft, or updates the mapped draft if this file was
uploaded before.
```
--project <name|id>    Assign to a project (created if a new name)
--draft <id>           Force-update a specific draft
--new                  Always create a new draft
--description <text>   Short label
--title <text>         Override the extracted <title>
--idempotency-key <k>  Dedupe retries (same key = same version)
--private              Create it owner-only (overrides the account default)
--public               Create it public (overrides the account default)
```
Output: public URL, draft id, version number, title. Warnings print to stderr.
Blocked HTML fails with the server's validation error codes.

`--private` / `--public` apply only when the draft is CREATED. Re-uploading to an existing
draft never changes its visibility — silently flipping a link you already shared would be a
nasty surprise. Use `agentdraft visibility` for that.

### `agentdraft visibility <public|private> [draft-id|url|file]`
Change who can read a draft. The URL never changes.
```
--all       Apply to EVERY existing draft in the account
--default   Set the default for NEW drafts (existing drafts untouched)
```
The target accepts a draft id, a full content URL, or a local file path you have uploaded
before (resolved through the same `drafts.json` mapping `upload` uses).

```bash
agentdraft visibility private plan.md        # the draft this file publishes to
agentdraft visibility public  a1b2c3d4e5f6   # by id
agentdraft visibility private --default      # only affects NEW drafts
agentdraft visibility public  --all          # every existing draft
```

A private draft's link still works **for you**: it redirects through the dashboard, which
verifies you own it. Anyone else gets a sign-in page. `--all` reports how many drafts
actually changed, so a no-op says so instead of claiming success.

### `agentdraft fetch <url|draft-id>`
Download served HTML.
```
-o, --output <file>    Write to a file instead of stdout
--version <n>          Fetch a specific version
```
Works on PRIVATE drafts too, provided you own them: the content origin answers with a
redirect, and the CLI retries through the authenticated API rather than following it. That
matters because following the redirect would write the dashboard's HTML **login page** to
your output file and exit 0 — a silent wrong-content success. With no stored credentials
the command exits 1 and writes nothing.

### `agentdraft list`
List your drafts.
```
--project <id>    Filter by project
--json            JSON output
--limit <n>       Max results (default 100)
```

### `agentdraft projects`
List your projects. `--json` for machine output.

### `agentdraft config`
```
agentdraft config                    Show current config
agentdraft config --api-url <url>    Point the CLI at a different instance
```

## Agent usage

```bash
agentdraft upload plan.html --project "my-project" --description "Architecture v2"
agentdraft fetch https://agentdraft-content.<sub>.workers.dev/d/abc123        # or curl the URL
agentdraft list --json
```

The CLI collects git metadata (branch, commit, dirty flag) automatically when run inside
a repository and attaches it to the version record.
