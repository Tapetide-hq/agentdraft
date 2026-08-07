# Security Policy

## Reporting a vulnerability

Email the maintainer (see the repository owner's profile) with details. Please do not
open a public issue for undisclosed vulnerabilities. Include reproduction steps and, if
possible, a proof-of-concept. You'll get an acknowledgement within a few days.

## Threat model

AgentDraft serves **fully attacker-controlled HTML**. The design separates two distinct
concerns that are often conflated:

### 1. Protecting the management account (dashboard + API)

Uploaded HTML must never be able to reach a dashboard session or API credential.

- **Origin isolation is the primary control.** User HTML is served from
  `agentdraft-content.<subdomain>.workers.dev` — a *different origin* from the API and
  dashboard (`agentdraft-api.…`, `agentdraft-dashboard.…`). A stored-XSS in a published page
  runs in the content origin, which holds no cookies and has no access to the other
  origins. Cookie `Path` scoping is explicitly **not** relied upon as a boundary — it
  isn't one against same-origin JavaScript.
- **The content origin never sets a cookie** and has no authentication bindings beyond
  read access to D1 and R2.
- **Defense in depth:** a strict CSP (`script-src 'none'`, `object-src 'none'`,
  `frame-src 'none'`, `connect-src 'none'`, `form-action 'none'`, `base-uri 'none'`),
  `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy`,
  `Cross-Origin-Opener-Policy`.
- **The dashboard is a BFF.** The API key lives in an httpOnly, Secure, SameSite=Strict
  cookie on the dashboard's own origin and is used only in server-side code. Browser
  JavaScript never holds a credential. The dashboard reaches the API via a Worker
  service binding, not a public fetch.
- **Upload validation** rejects active content at ingest (see below), so the CSP is a
  second layer rather than the only one.

### 2. Protecting the human viewer

Origin isolation does **not** make a published page "safe" for the person viewing it.
A byte-for-byte HTML document can still:

- Visually impersonate a login screen or a brand.
- Track viewers through remote `https:` images.
- Link to a phishing or malware site.

AgentDraft's purpose is publishing rich, self-contained HTML documents, so remote `https:`
images and links are **allowed by design**. Consequently:

- **Every published page is treated as untrusted content.** No page carries a claim of
  being sanitized-safe.
- All served content sends `X-Robots-Tag: noindex, nofollow` (published drafts are not
  meant to be search-indexed) and `Referrer-Policy: no-referrer`.
- Drafts can be disabled (returns HTTP 451) and there is an abuse-report path.
- Consumers of a AgentDraft URL should treat it as they would any user-generated content.

## HTML validation policy

Validated server-side by a real HTML5 parser (parse5) — never a regex/blocklist over
raw bytes, which is bypassable. The normative policy and its ~60-case conformance
corpus live in [`shared/html-policy.md`](./shared/html-policy.md) and
[`shared/html-policy-fixtures.json`](./shared/html-policy-fixtures.json).

Rejected at upload: `<script>` (all forms), `<iframe>`/`<frame>`/`<object>`/`<embed>`,
`<form>` and form controls, `<base>`, `<link>`, inline event handlers, `javascript:`/
`vbscript:`/`file:`/`data:text/html` URLs (with entity/whitespace/case normalization
before scheme checks), `srcdoc`, `<meta http-equiv=refresh>`, dangerous CSS
(`expression()`, `behavior:`, `@import`, `url(javascript:)`), mXSS namespace-confusion
constructs (`<svg><script>`, `<math><annotation-xml encoding=text/html>`), and
`<template>`/`<noscript>` parse-differential smuggling. Documents over 2 MiB and
non-UTF-8 bodies are rejected.

The CLI performs only transport-level pre-checks (size, UTF-8, empty). The server is the
sole validation authority — a second full validator would drift from it.

## Byte-for-byte serving vs CDN HTML injection (self-hosting hazard)

AgentDraft promises that a published document is served byte-for-byte. Cloudflare zone
features that **rewrite HTML in flight** silently break that promise *and* inject
`<script>` into content whose entire security model guarantees none:

- **Web Analytics / RUM auto-install** — appends a `cloudflareinsights.com/beacon.min.js`
  `<script>` tag.
- **Email Obfuscation** — rewrites `mailto:` links and injects `/cdn-cgi/` script.
- **Rocket Loader** — rewrites and defers scripts.
- **Mirage** — rewrites `<img>` tags.

Several of these are **gated on a browser user-agent**, so `curl` with its default UA
sees clean bytes while every real visitor gets injected HTML. Testing only with a
default-UA client will FALSE-PASS this.

If you serve content through a proxied Cloudflare zone (not `*.workers.dev`), disable
them for the content host. A Configuration Rule scoped to the host is the correct fix —
it avoids changing zone-wide settings that other apps on the same zone may rely on:

```
Expression: (http.host eq "your-content-host.example.com")
Action: set_config
  disable_rum: true
  email_obfuscation: false
  rocket_loader: false
  mirage: false
```

`tests/brutal.sh` asserts this under a spoofed browser user-agent on both the canonical
and `/raw` paths, and asserts no `<script>` reaches a served document.

## API key security

- Keys are `ad_` + 40 chars of CSPRNG output (~200 bits of entropy).
- Only a domain-separated SHA-256 digest is stored (peppered). Keys are never stored or
  logged in plaintext, and the full value is shown exactly once at creation.
- Key stretching (PBKDF2/bcrypt) is deliberately **not** used: keys are high-entropy
  random tokens, not human passwords, so stretching buys nothing and the Workers runtime
  caps PBKDF2 iterations anyway. This is the construction used by Stripe/GitHub API
  tokens.
- Keys are scoped (`upload`, `read`, `manage`); minting new keys requires the `manage`
  scope, so an `upload`/`read` key cannot escalate.
- Keys are revocable instantly.

## Rate limiting

KV-backed fixed-window counters, keyed on the API key (or IP for unauthenticated reads):
uploads 100/hour, reads 1000/hour. Fixed windows are coarse but adequate for abuse
prevention on the free tier without Durable Objects.

## What v1 does NOT include

- **No anonymous uploads.** Publishing requires an owner-tied, revocable key. Public
  *reading* is anonymous. (Anonymous publishing would make this a free phishing host;
  it is intentionally out of scope.)
- **No public self-service signup.** v1 is invite-only: the owner bootstraps the first
  key and mints scoped keys. Google OAuth exists only as a schema/interface seam.
