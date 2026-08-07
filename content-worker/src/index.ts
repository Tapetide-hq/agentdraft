// WebHost content-serving Worker.
//
// Serves uploaded HTML byte-for-byte from an ISOLATED origin. It only ever READS
// D1 + R2. It never authenticates a user and never sets a cookie. Every response is
// treated as untrusted content (see SECURITY.md): strict CSP, noindex, no-referrer.

// Bindings come from `wrangler types` (worker-configuration.d.ts, generated from
// wrangler.jsonc) rather than being hand-written, so a config change that drops or
// renames a binding becomes a compile error instead of a runtime crash.
type Env = globalThis.Env;

interface DraftRow {
  id: string;
  published_version: number | null;
  current_version_id: string | null;
  is_public: number;
  disabled_at: string | null;
  disabled_reason: string | null;
  deleted_at: string | null;
}

interface VersionRow {
  id: string;
  version_number: number;
  object_key: string;
  content_hash: string;
}

// Defense-in-depth CSP. script-src 'none' means even if validation somehow let a
// script through, the browser won't execute it. style-src 'unsafe-inline' is required
// because the product's whole point is self-contained styled documents.
const CSP = [
  "default-src 'none'",
  "img-src https: data:",
  "style-src 'unsafe-inline'",
  "font-src https: data:",
  "media-src https:",
  "script-src 'none'",
  "connect-src 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'", // allow dashboard preview iframe on the api origin
  "base-uri 'none'",
].join("; ");

function securityHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
    ...extra,
  };
}

// RFC 9110 If-None-Match: a comma-separated list of entity-tags, or "*". Tags may
// carry a W/ prefix, which is stripped for comparison (weak comparison is what a
// conditional GET requires). Returns true when the client's cached copy is current.
function ifNoneMatchMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  const strip = (t: string) => t.trim().replace(/^W\//, "");
  const want = strip(etag);
  return header
    .split(",")
    .some((t) => {
      const got = strip(t);
      return got === "*" || got === want;
    });
}

function textResponse(status: number, msg: string): Response {
  return new Response(msg, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return textResponse(405, "Method Not Allowed");
    }

    // Routes:
    //   /d/:id            latest
    //   /d/:id/raw        latest (alias)
    //   /d/:id/v/:n       specific version
    //   /d/:id/v/:n/raw   specific version (alias)
    const m = url.pathname.match(/^\/d\/([a-z0-9]{6,32})(?:\/v\/(\d+))?(?:\/raw)?\/?$/);
    if (url.pathname === "/" ) {
      return new Response(
        JSON.stringify({ ok: true, service: "webhost-content", note: "Serves published HTML at /d/:id" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }
    if (!m) return textResponse(404, "Not Found");

    const draftId = m[1];
    const explicitVersion = m[2] ? parseInt(m[2], 10) : null;

    const ifNoneMatch = request.headers.get("if-none-match");

    // The draft's STATUS GATE must run before any cache lookup.
    //
    // Serving a cache hit first is a security hole: a draft that has since been
    // soft-deleted, disabled, or made private would keep being served publicly from
    // cache. Purging on delete is NOT a fix — the Cache API is per-colo, so a delete
    // executed in one colo cannot evict copies held by the others. The only correct
    // design is to authorize against D1 on every request and treat the cache purely as
    // an R2 read-through, which is also the expensive half (R2 GET + body transfer).
    const draft = await env.DB.prepare(
      "SELECT id, published_version, current_version_id, is_public, disabled_at, disabled_reason, deleted_at FROM drafts WHERE id = ?",
    )
      .bind(draftId)
      .first<DraftRow>();

    if (!draft || draft.deleted_at) return textResponse(404, "Not Found");
    if (!draft.is_public) return textResponse(403, "This draft is not public.");
    if (draft.disabled_at) {
      return textResponse(451, `This document has been disabled. ${draft.disabled_reason ?? ""}`.trim());
    }

    // Only now may we answer from cache. Keyed on the URL alone so conditional headers
    // don't fragment it.
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    if (request.method === "GET") {
      const hit = await cache.match(cacheKey);
      if (hit) {
        // A cache hit must STILL honour If-None-Match. Because the cache key omits
        // conditional headers, returning `hit` directly would answer a revalidation
        // with a full 200 body — silently defeating the 304 path for exactly the
        // hot objects it matters most for.
        const hitEtag = hit.headers.get("etag");
        if (hitEtag && ifNoneMatchMatches(ifNoneMatch, hitEtag)) {
          return new Response(null, { status: 304, headers: hit.headers });
        }
        return hit;
      }
    }

    // Resolve the version.
    let version: VersionRow | null = null;
    if (explicitVersion != null) {
      version = await env.DB.prepare(
        "SELECT id, version_number, object_key, content_hash FROM draft_versions WHERE draft_id = ? AND version_number = ?",
      )
        .bind(draftId, explicitVersion)
        .first<VersionRow>();
    } else if (draft.current_version_id) {
      version = await env.DB.prepare(
        "SELECT id, version_number, object_key, content_hash FROM draft_versions WHERE id = ?",
      )
        .bind(draft.current_version_id)
        .first<VersionRow>();
    } else if (draft.published_version != null) {
      version = await env.DB.prepare(
        "SELECT id, version_number, object_key, content_hash FROM draft_versions WHERE draft_id = ? AND version_number = ?",
      )
        .bind(draftId, draft.published_version)
        .first<VersionRow>();
    }
    if (!version) return textResponse(404, "No such version.");

    // Immutable versioned URLs cache hard; the mutable latest URL caches briefly.
    const immutable = explicitVersion != null;
    const cacheControl = immutable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=60";

    // The content hash IS the ETag: identical bytes always produce the same value, and
    // stored objects are immutable, so it is a strong validator (no W/ prefix).
    const etag = `"${version.content_hash}"`;

    const headers = securityHeaders({
      "Cache-Control": cacheControl,
      ETag: etag,
      "X-WebHost-Draft-Id": draftId,
      "X-WebHost-Version": String(version.version_number),
    });

    // Honour conditional requests BEFORE touching R2. Emitting an ETag without
    // handling If-None-Match means every revalidation pays a full R2 read plus the
    // whole body over the wire. A 304 costs one D1 lookup and zero R2 Class B ops.
    if (ifNoneMatchMatches(ifNoneMatch, etag)) {
      return new Response(null, { status: 304, headers });
    }

    // HEAD needs metadata only — use R2 head() so we never open a body we discard.
    if (request.method === "HEAD") {
      const meta = await env.STORAGE.head(version.object_key);
      if (!meta) return textResponse(404, "Content unavailable.");
      headers["Content-Length"] = String(meta.size);
      return new Response(null, { status: 200, headers });
    }

    const obj = await env.STORAGE.get(version.object_key);
    if (!obj) {
      // D1 row without an R2 object — should be impossible given R2-first ordering.
      return textResponse(404, "Content unavailable.");
    }

    // Stream the R2 body straight through rather than buffering it with .text().
    // Documents are capped at 2 MiB by validation, but streaming keeps memory flat
    // regardless and starts the response sooner (Workers has a 128 MB limit).
    const response = new Response(obj.body, { status: 200, headers });

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
