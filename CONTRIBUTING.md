# Contributing to WebHost

Thanks for your interest. WebHost is a Cloudflare-native monorepo with four parts.

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
- `cli/`: `go vet ./...`, `go test ./...`, `go build -o webhost .`.

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

## Security

Please report vulnerabilities privately — see [SECURITY.md](./SECURITY.md).
