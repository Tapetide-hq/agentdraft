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

- `config.json` — `{ "api_url": "https://api.postplan.tapetide.com" }`
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

### `agentdraft fetch <url|draft-id>`
Download served HTML.
```
-o, --output <file>    Write to a file instead of stdout
--version <n>          Fetch a specific version
```

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
