// AgentDraft content-serving Worker.
//
// Serves uploaded HTML byte-for-byte from an ISOLATED origin. It only ever READS
// D1 + R2. It never authenticates a user and never sets a cookie. Every response is
// treated as untrusted content (see SECURITY.md): strict CSP, noindex, no-referrer.

// Bindings come from `wrangler types` (worker-configuration.d.ts, generated from
// wrangler.jsonc) rather than being hand-written, so a config change that drops or
// renames a binding becomes a compile error instead of a runtime crash.
import { iconResponse } from "./icons.js";

type Env = globalThis.Env;

// MIRROR of worker/src/services/files.ts INLINE_ALLOWLIST — the two workers do not share a
// module, so keep these identical. The ONLY types served inline; everything else downloads
// (Content-Disposition: attachment). text/html and image/svg+xml are deliberately ABSENT:
// serving either inline on this origin would let an uploaded "file" execute as a page on
// the same origin that also holds documents. That is the one rule that keeps the file lane
// safe on the shared origin.
const INLINE_ALLOWLIST = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "text/plain",
  "application/pdf",
]);

function isInlineType(contentType: string): boolean {
  return INLINE_ALLOWLIST.has(contentType.split(";")[0].trim().toLowerCase());
}

// Build a Content-Disposition header with an ASCII-safe fallback and an RFC 5987
// filename* for full-fidelity names.
function contentDisposition(disposition: "inline" | "attachment", filename: string): string {
  const ascii = filename.replace(/[\x00-\x1f"\\]/g, "_").replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

interface FileRow {
  id: string;
  object_key: string;
  filename: string;
  content_type: string;
  file_size: number;
  disabled_at: string | null;
  disabled_reason: string | null;
  deleted_at: string | null;
}

// Serve a stored arbitrary file at /f/:id. Default is ATTACHMENT (download); inline only
// for the strict allowlist. Always nosniff. Honors Range for media seeking.
async function serveFile(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  fileId: string,
): Promise<Response> {
  const row = await env.DB.prepare(
    "SELECT id, object_key, filename, content_type, file_size, disabled_at, disabled_reason, deleted_at FROM files WHERE id = ?",
  )
    .bind(fileId)
    .first<FileRow>();

  if (!row || row.deleted_at) return textResponse(404, "Not Found");
  if (row.disabled_at) {
    return textResponse(451, `This file has been disabled. ${row.disabled_reason ?? ""}`.trim());
  }

  const inline = isInlineType(row.content_type);
  // The file id is immutable — its bytes never change — so a versioned-style hard cache is
  // correct. The ETag is the object key, which is unique per upload.
  const etag = `"${row.object_key}"`;

  const baseHeaders: Record<string, string> = {
    "Content-Type": row.content_type,
    // ALWAYS nosniff: a file that lies about its type cannot be reinterpreted as markup.
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", row.filename),
    // No document capabilities on a raw file. sandbox with no allow-* neuters any active
    // content even if a browser somehow tried to execute it.
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    // Files are never embedded in the dashboard preview, so this can be strict — unlike the
    // draft path, which must allow the dashboard origin to frame it.
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
    "Accept-Ranges": "bytes",
    "X-AgentDraft-File-Id": fileId,
  };

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatchMatches(ifNoneMatch, etag)) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }

  // HEAD: metadata only.
  if (request.method === "HEAD") {
    const meta = await env.STORAGE.head(row.object_key);
    if (!meta) return textResponse(404, "Content unavailable.");
    baseHeaders["Content-Length"] = String(meta.size);
    return new Response(null, { status: 200, headers: baseHeaders });
  }

  // Range request — parse a single "bytes=start-end". Enables in-browser media seeking.
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const size = row.file_size;
    const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (match[1] === "" && match[2] === "")) {
      return textResponse(416, "Range Not Satisfiable");
    }
    let start: number;
    let end: number;
    if (match[1] === "") {
      // suffix range: last N bytes
      const suffix = parseInt(match[2], 10);
      if (suffix === 0) return rangeNotSatisfiable(size);
      start = Math.max(0, size - suffix);
      end = size - 1;
    } else {
      start = parseInt(match[1], 10);
      end = match[2] === "" ? size - 1 : parseInt(match[2], 10);
    }
    if (start > end || start >= size) return rangeNotSatisfiable(size);
    end = Math.min(end, size - 1);

    const obj = await env.STORAGE.get(row.object_key, {
      range: { offset: start, length: end - start + 1 },
    });
    if (!obj) return textResponse(404, "Content unavailable.");
    const partialHeaders = {
      ...baseHeaders,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
    };
    // Do NOT cache 206 partials — the Cache API keys on URL, and a cached partial would be
    // served to a client asking for the whole object.
    return new Response(obj.body, { status: 206, headers: partialHeaders });
  }

  // Full GET — serve from cache when possible, else stream from R2 and cache.
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) {
    const hitEtag = hit.headers.get("etag");
    if (hitEtag && ifNoneMatchMatches(ifNoneMatch, hitEtag)) {
      return new Response(null, { status: 304, headers: hit.headers });
    }
    return hit;
  }

  const obj = await env.STORAGE.get(row.object_key);
  if (!obj) return textResponse(404, "Content unavailable.");
  baseHeaders["Content-Length"] = String(row.file_size);
  const response = new Response(obj.body, { status: 200, headers: baseHeaders });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function rangeNotSatisfiable(size: number): Response {
  return new Response("Range Not Satisfiable", {
    status: 416,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Range": `bytes */${size}`,
      "X-Robots-Tag": "noindex",
    },
  });
}

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
  source_format: string | null;
}

// Companion key holding the rendered HTML for a Markdown version. Mirrors
// renderedKey() in the API worker — kept in sync deliberately by convention because the
// two workers do not share a module.
function renderedKeyFor(sourceKey: string): string {
  return sourceKey.replace(/\.html$/, "") + ".rendered.html";
}

// Defense-in-depth CSP. script-src 'none' means even if validation somehow let a
// script through, the browser won't execute it. style-src 'unsafe-inline' is required
// because the product's whole point is self-contained styled documents.
//
// frame-ancestors is built PER REQUEST because it must name the dashboard origin
// explicitly. It previously read `frame-ancestors 'self'` with a comment claiming that
// allowed the dashboard preview iframe — it does not. 'self' is THIS origin (the content
// origin); the dashboard is a DIFFERENT origin, so the browser refused the frame and the
// preview rendered as Chrome's blank subframe error page. The comment asserted the
// opposite of the behaviour, which is why it survived review.
function buildCSP(dashboardOrigin: string | undefined): string {
  // Fall back to 'none' rather than 'self' when unset: if the embedding origin is not
  // configured, refusing all framing is the safe default. 'self' would be a lie either
  // way, and a permissive fallback on an untrusted-content origin is the wrong risk.
  const frameAncestors = dashboardOrigin ? `frame-ancestors ${dashboardOrigin}` : "frame-ancestors 'none'";
  return [
    "default-src 'none'",
    "img-src https: data:",
    "style-src 'unsafe-inline'",
    "font-src https: data:",
    "media-src https:",
    "script-src 'none'",
    "connect-src 'none'",
    "form-action 'none'",
    frameAncestors,
    "base-uri 'none'",
  ].join("; ");
}

function securityHeaders(
  dashboardOrigin: string | undefined,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": buildCSP(dashboardOrigin),
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    // CORP is a SECOND, INDEPENDENT embedding gate. `same-origin` blocks the dashboard
    // preview iframe even when frame-ancestors already allows it — fixing only the CSP
    // left the frame refused with an IDENTICAL blank-frame symptom, which is how the
    // first fix passed verification while the preview stayed broken in prod.
    //
    // `same-site` (not a removal) because both origins are tapetide.com subdomains: the
    // dashboard can embed a draft, while an arbitrary third-party site still cannot
    // hotlink one. Dropping CORP altogether would open embedding to everyone.
    "Cross-Origin-Resource-Policy": "same-site",
    // COOP governs WINDOW references (window.opener), not framing, so it stays strict.
    // Loosening it would buy nothing for the preview and weaken isolation of untrusted
    // content.
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
    const m = url.pathname.match(/^\/d\/([a-z0-9]{6,32})(?:\/v\/(\d+))?(\/raw)?\/?$/);
    if (url.pathname === "/" ) {
      return new Response(
        JSON.stringify({ ok: true, service: "agentdraft-content", note: "Serves published HTML at /d/:id" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }

    // Brand icons. A browser asks the ORIGIN ROOT for /favicon.ico whenever a document
    // declares no icon of its own, which every uploaded document does — we serve pages
    // byte-for-byte and must not inject a <link> into user HTML. Answering here gives
    // every published draft a real tab icon while leaving content untouched.
    const icon = iconResponse(url.pathname, request.method);
    if (icon) return icon;

    // File lane: /f/:id. Matched BEFORE the draft path so the two namespaces never
    // collide. Files are served attachment-by-default with a strict inline allowlist.
    const fm = url.pathname.match(/^\/f\/([a-z0-9]{6,32})\/?$/);
    if (fm) return serveFile(request, env, ctx, fm[1]);

    if (!m) return textResponse(404, "Not Found");

    const draftId = m[1];
    const explicitVersion = m[2] ? parseInt(m[2], 10) : null;
    // /raw always yields the EXACT uploaded bytes. For HTML that is the same document
    // served at /d/:id; for Markdown it is the Markdown source, which is what makes the
    // byte-for-byte guarantee hold for md uploads too.
    const wantRaw = !!m[3];

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

    // PRIVATE DRAFT -> hand off to the dashboard, never serve it here.
    //
    // This worker is cookie-free BY DESIGN: it serves attacker-controlled HTML, so a
    // session must never be readable on this origin. It therefore cannot authorize a
    // viewer itself. Instead it redirects to the dashboard, which holds the session,
    // verifies OWNERSHIP, and streams the same bytes from its own origin.
    //
    // The user experience is "the same link just opens when I'm signed in": the shared
    // URL is unchanged, and the redirect is invisible in normal browsing. A signed-out
    // viewer lands on sign-in and returns to this exact draft afterwards.
    //
    // 302 not 301: visibility is a mutable property. A permanent redirect would be
    // cached by browsers and intermediaries, so a draft later made public again would
    // keep bouncing to the dashboard from stale caches.
    //
    // Known and accepted: this distinguishes "private" from "nonexistent" to anyone
    // probing ids, i.e. an existence oracle. With 113-bit ids (and 62-bit legacy ids)
    // guessing an id is infeasible, so the oracle is not exploitable, and collapsing
    // private into 404 would make a genuine typo indistinguishable from someone else's
    // private draft — worse for users, no real gain.
    if (!draft.is_public) {
      const dash = env.DASHBOARD_ORIGIN?.replace(/\/$/, "");
      if (!dash) {
        // Fail CLOSED. With no dashboard configured there is nowhere to authorize the
        // viewer, and serving the bytes would publish a draft the owner marked private.
        return textResponse(403, "This draft is private.");
      }
      // Preserve the full path so /v/2 and /raw survive the hand-off and the viewer
      // lands on the exact representation they asked for.
      const target = `${dash}/private${url.pathname}${url.search}`;
      return new Response(null, {
        status: 302,
        headers: {
          Location: target,
          // A private draft must never be cached by a shared cache: the next viewer
          // may be a different principal with different rights.
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }
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
        "SELECT id, version_number, object_key, content_hash, source_format FROM draft_versions WHERE draft_id = ? AND version_number = ?",
      )
        .bind(draftId, explicitVersion)
        .first<VersionRow>();
    } else if (draft.current_version_id) {
      version = await env.DB.prepare(
        "SELECT id, version_number, object_key, content_hash, source_format FROM draft_versions WHERE id = ?",
      )
        .bind(draft.current_version_id)
        .first<VersionRow>();
    } else if (draft.published_version != null) {
      version = await env.DB.prepare(
        "SELECT id, version_number, object_key, content_hash, source_format FROM draft_versions WHERE draft_id = ? AND version_number = ?",
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

    const isMd = (version.source_format ?? "html") === "md";

    // Which R2 object to serve:
    //   /raw            -> ALWAYS the exact uploaded bytes (source)
    //   /d/:id (md)     -> the pre-rendered HTML companion object, so a human opening
    //                      the URL reads a formatted document instead of raw asterisks
    //   /d/:id (html)   -> the source, which IS the document
    const serveRendered = isMd && !wantRaw;
    const key = serveRendered ? renderedKeyFor(version.object_key) : version.object_key;

    // Markdown source served at /raw is text/markdown, not text/html — sending it as
    // HTML would make the browser try to parse asterisks as markup, and it would also
    // mean untrusted text is interpreted in an HTML context.
    const contentType =
      wantRaw && isMd ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8";

    // The ETag is the hash of the SOURCE bytes. Rendered and raw representations of the
    // same version therefore share a hash, so they must not share a cache entry or a
    // validator — the URL differs (…/raw), so the Cache API key already differs, and we
    // vary the tag by representation to keep conditional requests correct.
    const repEtag = serveRendered ? `"${version.content_hash}-r"` : etag;

    const headers = securityHeaders(env.DASHBOARD_ORIGIN, {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      ETag: repEtag,
      "X-AgentDraft-Draft-Id": draftId,
      "X-AgentDraft-Version": String(version.version_number),
      "X-AgentDraft-Format": isMd ? "md" : "html",
    });

    // Honour conditional requests BEFORE touching R2. Emitting an ETag without
    // handling If-None-Match means every revalidation pays a full R2 read plus the
    // whole body over the wire. A 304 costs one D1 lookup and zero R2 Class B ops.
    if (ifNoneMatchMatches(ifNoneMatch, repEtag)) {
      return new Response(null, { status: 304, headers });
    }

    // HEAD needs metadata only — use R2 head() so we never open a body we discard.
    if (request.method === "HEAD") {
      const meta = await env.STORAGE.head(key);
      if (!meta) return textResponse(404, "Content unavailable.");
      headers["Content-Length"] = String(meta.size);
      return new Response(null, { status: 200, headers });
    }

    const obj = await env.STORAGE.get(key);
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
