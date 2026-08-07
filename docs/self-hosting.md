# Self-Hosting WebHost

WebHost runs entirely on Cloudflare's free tier.

## Prerequisites

- A Cloudflare account.
- [Bun](https://bun.sh) (or npm) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/).
- Go 1.24+ (only to build the CLI).

## 1. Clone and create resources

```bash
git clone https://github.com/Tapetide-hq/webhost.git
cd webhost

wrangler d1 create webhost-db          # note the database_id
wrangler r2 bucket create webhost-html
wrangler kv namespace create webhost-ratelimit   # note the id
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
wrangler d1 migrations apply webhost-db --remote
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
curl -X POST https://webhost-api.<sub>.workers.dev/api/bootstrap \
  -H "x-bootstrap-secret: <your BOOTSTRAP_SECRET>" \
  -H "content-type: application/json" \
  -d '{"name":"Owner","email":"you@example.com"}'
# → returns your first API key (shown once). Store it.
```

## 7. Use it

```bash
cd cli && go build -o webhost .
./webhost config --api-url https://webhost-api.<sub>.workers.dev
./webhost auth set wh_...
echo '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>' > test.html
./webhost upload test.html
```

## Custom domains

Add routes in the Cloudflare dashboard (Workers → your worker → Triggers → Custom
Domains) for `api.example.com` → `webhost-api`, `example.com` → `webhost-content`, and
`app.example.com` → `webhost-dashboard`. Then update the `vars` URLs and redeploy.

## Costs

At hobby scale this is **$0/month** (Workers 100k req/day, D1 5M reads/day, R2 10 GB +
10M reads/month, KV, all within free tier). At scale, Workers Paid ($5/mo) plus R2
storage ($0.015/GB/mo) keeps most instances under $10/mo.
