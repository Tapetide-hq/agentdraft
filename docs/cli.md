# CLI Reference

The `webhost` CLI is a single Go binary with no runtime dependencies.

## Install

```bash
# From source (requires Go 1.24+)
go install github.com/Hitesh-Sisara/webhost/cli@latest

# Or download a release binary
curl -fsSL https://raw.githubusercontent.com/Hitesh-Sisara/webhost/main/cli/install.sh | sh
```

## Configuration

State lives in `~/.webhost/` (dir `0700`, files `0600`):

- `config.json` — `{ "api_url": "https://webhost-api.tapetide.workers.dev" }`
- `credentials.json` — `{ "api_key": "wh_…", "account_id": "acct_…" }`
- `drafts.json` — maps local file paths to draft IDs so re-uploads update the same draft

## Commands

### `webhost auth`
```
webhost auth login          Interactive: paste an API key (verified server-side)
webhost auth set <key>      Store an API key non-interactively (verified server-side)
webhost auth logout         Remove stored credentials
```

### `webhost whoami`
Prints the current account, auth method, and scopes.

### `webhost upload <file>`
Upload an HTML file. Creates a new draft, or updates the mapped draft if this file was
uploaded before.
```
--project <name|id>    Assign to a project (created if a new name)
--draft <id>           Force-update a specific draft
--new                  Always create a new draft
--description <text>   Short label
--title <text>         Override the extracted <title>
--idempotency-key <k>  Dedupe retries (same key = same version)
```
Output: public URL, draft id, version number, title. Warnings print to stderr.
Blocked HTML fails with the server's validation error codes.

### `webhost fetch <url|draft-id>`
Download served HTML.
```
-o, --output <file>    Write to a file instead of stdout
--version <n>          Fetch a specific version
```

### `webhost list`
List your drafts.
```
--project <id>    Filter by project
--json            JSON output
--limit <n>       Max results (default 100)
```

### `webhost projects`
List your projects. `--json` for machine output.

### `webhost config`
```
webhost config                    Show current config
webhost config --api-url <url>    Point the CLI at a different instance
```

## Agent usage

```bash
webhost upload plan.html --project "my-project" --description "Architecture v2"
webhost fetch https://webhost-content.<sub>.workers.dev/d/abc123        # or curl the URL
webhost list --json
```

The CLI collects git metadata (branch, commit, dirty flag) automatically when run inside
a repository and attaches it to the version record.
