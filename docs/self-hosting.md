# Self-Hosting AgentDraft

AgentDraft runs entirely on Cloudflare's free tier.

## Prerequisites

- A Cloudflare account.
- [Bun](https://bun.sh) (or npm) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/).
- Go 1.24+ (only to build the CLI).

## 1. Clone and create resources

```bash
git clone https://github.com/Tapetide-hq/agentdraft.git
cd agentdraft

wrangler d1 create agentdraft-db          # note the database_id
wrangler r2 bucket create agentdraft-html
wrangler kv namespace create agentdraft-ratelimit   # note the id
```

## 2. Configure

Edit `worker/wrangler.jsonc` and `content-worker/wrangler.jsonc`:
- set `d1_databases[0].database_id` to your D1 id
- set `kv_namespaces[0].id` (worker only) to your KV id

Set the public URLs to your own `*.workers.dev` subdomain (or custom domain) in the
`vars` blocks of all three `wrangler.jsonc` files (`CONTENT_BASE_URL`,
`DASHBOARD_ORIGIN`, `API_BASE_URL`).

## 3. Migrate the database

```bash
cd worker
wrangler d1 migrations apply agentdraft-db --remote
```

## 4. Set secrets (API worker)

```bash
cd worker
wrangler secret put BOOTSTRAP_SECRET   # a long random string; guards /api/bootstrap
wrangler secret put API_KEY_PEPPER     # a long random string; domain-separates key hashes
# Optional OAuth seam (unused in v1):
# wrangler secret put GOOGLE_CLIENT_ID
# wrangler secret put GOOGLE_CLIENT_SECRET
```

## 4b. Google sign-in (optional but recommended)

Google OAuth is **dormant until configured** — every OAuth route returns 503 and the
dashboard hides the button, so an instance without an IdP still works via API keys.

When it IS configured, minting an API key requires a verified Google identity. That
matters because an API key is a bearer token that ends up in CI config, dotfiles and
agent environments: if a leaked key could mint more keys, revoking the leaked one would
not contain the breach. Listing and *revoking* keys deliberately stay available without
Google — you must always be able to revoke, even when your IdP is down.

Create the OAuth client (this step requires a human; there is no API for it):

1. [Google Cloud Console](https://console.cloud.google.com/) → new or existing project
2. **APIs & Services → OAuth consent screen** → External → add your email as a test user
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
4. Application type: **Web application**
5. **Authorized redirect URI** — must match exactly:
   `https://app.<your-domain>/auth/google/callback`
6. Copy the Client ID and Client Secret

Then configure the worker:

```bash
cd worker
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
# flip the flag in wrangler.jsonc: "GOOGLE_OAUTH_ENABLED": "true"
wrangler deploy
```

Verify: `curl https://api.<your-domain>/api/config` should report
`"google_oauth_enabled": true`, and `/auth/google` on the dashboard should redirect to
Google rather than back to `/login?google=unavailable`.

Implementation notes: Authorization Code flow with PKCE (S256) and a stored, single-use
`state`; the `id_token` is verified against Google's JWKS for signature, issuer,
**audience** and expiry, and `email_verified` is required. Accounts link on the immutable
`sub` claim, never on email — Google emails change, `sub` does not. The audience pin is
load-bearing: Google signs every project's tokens with the same keys, so a valid
signature alone proves nothing about which app a token was issued for.

## 5. Deploy

Deploy the content worker first (the API references its URL), then the API, then the
dashboard:

```bash
cd content-worker && bun install && bun run deploy
cd ../worker        && bun install && bun run deploy
cd ../dashboard     && bun install && bun run deploy
```

## 6. Bootstrap the first key

```bash
curl -X POST https://agentdraft-api.<sub>.workers.dev/api/bootstrap \
  -H "x-bootstrap-secret: <your BOOTSTRAP_SECRET>" \
  -H "content-type: application/json" \
  -d '{"name":"Owner","email":"you@example.com"}'
# → returns your first API key (shown once). Store it.
```

## 7. Use it

```bash
cd cli && go build -o agentdraft .
./agentdraft config --api-url https://agentdraft-api.<sub>.workers.dev
./agentdraft auth set ad_...
echo '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>' > test.html
./agentdraft upload test.html
```

## Custom domains

Add routes in the Cloudflare dashboard (Workers → your worker → Triggers → Custom
Domains) for `api.example.com` → `agentdraft-api`, `example.com` → `agentdraft-content`, and
`app.example.com` → `agentdraft-dashboard`. Then update the `vars` URLs and redeploy.

## Costs

At hobby scale this is **$0/month** (Workers 100k req/day, D1 5M reads/day, R2 10 GB +
10M reads/month, KV, all within free tier). At scale, Workers Paid ($5/mo) plus R2
storage ($0.015/GB/mo) keeps most instances under $10/mo.
