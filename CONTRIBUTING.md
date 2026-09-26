# Contributing to AgentDraft

Thanks for your interest. AgentDraft is a Cloudflare-native monorepo with four parts.

## Layout

```
worker/          API + validation (Hono/TS on Workers)
content-worker/  Isolated HTML-serving worker
dashboard/       SvelteKit BFF on Workers
cli/             Go CLI
shared/          HTML policy spec + conformance corpus (drives worker tests)
docs/            API/CLI/architecture/self-hosting + OpenAPI
```

## Dev setup

- Node/Bun + Wrangler for the workers and dashboard; Go 1.24+ for the CLI.
- `worker/`: `bun install`, `bun run test`, `bunx tsc --noEmit`, `bun run dev`.
- `content-worker/`: `bun install`, `bunx tsc --noEmit`, `bun run dev`.
- `dashboard/`: `bun install`, `bun run check`, `bun run build`, `bun run dev`.
- `cli/`: `go vet ./...`, `go test ./...`, `go build -o agentdraft .`.

## The HTML policy is shared, on purpose

The validation policy is specified once in `shared/html-policy.md` and enforced by a
single authoritative server validator (`worker/src/services/html-validator.ts`), tested
against `shared/html-policy-fixtures.json`. If you change what's allowed/blocked:

1. Update `shared/html-policy.md`.
2. Add/adjust cases in `shared/html-policy-fixtures.json`.
3. Make `bun run test` pass in `worker/`.

The CLI does transport-only pre-checks and must not attempt to re-implement the policy.

## Pull requests

- Keep changes scoped; one concern per PR.
- Run the relevant test/build commands before opening.
- Match existing style. TypeScript is strict; Go must `vet` clean.
- Never commit secrets. `wrangler.jsonc` holds only resource ids, never tokens.
- Commits use conventional-commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`).

## CI and releases

Every PR runs the checks for the parts it touches (`cli.yml`, `worker.yml`,
`dashboard.yml`, `tests.yml`, `lint-workflows.yml`). `main` accepts squash-merged pull
requests only; Dependabot patch and minor bumps are approved and auto-merged once green,
majors wait for a human.

Merging to `main` deploys the three Cloudflare Workers automatically (`deploy.yml`),
migrations first. Nothing else is needed for the hosted service. The one wrinkle: a merge
made by the Dependabot auto-merge workflow uses the Actions token, which does not fire
push-triggered workflows, so that workflow dispatches `deploy.yml` itself for exactly the
parts the PR touched.

The CLI is released on demand: **Actions → Release CLI → Run workflow**, enter the
version (`0.3.0`). The workflow runs the Go tests, tags `main` as `v0.3.0` and
`cli/v0.3.0`, builds all six binaries with goreleaser, publishes the GitHub release with
`checksums.txt`, and smoke-tests `cli/install.sh` against it. The `cli/` tag is what makes
`go install github.com/Tapetide-hq/agentdraft/cli@latest` resolve to that release, so
never push one without the other. Pushing a `v*` tag by hand also works; the workflow adds
the missing `cli/` tag itself.

## Security

Please report vulnerabilities privately — see [SECURITY.md](./SECURITY.md).
