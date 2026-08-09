import { Hono } from "hono";
import type { Env } from "../env.js";
import type { AuthContext, Draft, DraftVersion } from "../types.js";
import { jsonError, readJsonObject } from "../lib/http.js";
import { renderedKey } from "../services/storage.js";

const drafts = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

function contentUrls(env: Env, draftId: string) {
  const base = env.CONTENT_BASE_URL.replace(/\/$/, "");
  return {
    public_url: `${base}/d/${draftId}`,
    raw_url: `${base}/d/${draftId}/raw`,
  };
}

// GET /api/drafts — all account drafts (optionally ?project=<id>, ?limit=<n>).
drafts.get("/", async (c) => {
  const auth = c.get("auth");
  const project = c.req.query("project");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "100", 10) || 100, 500);
  // source_format lives on draft_versions, so surface the CURRENT version's format via
  // a correlated subquery instead of duplicating the column onto drafts (which would
  // then need keeping in sync on every upload — a drift bug waiting to happen).
  const fmt =
    "(SELECT v.source_format FROM draft_versions v WHERE v.id = drafts.current_version_id) AS source_format";
  const sql = project
    ? `SELECT drafts.*, ${fmt} FROM drafts WHERE account_id = ? AND project_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?`
    : `SELECT drafts.*, ${fmt} FROM drafts WHERE account_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?`;
  const stmt = project
    ? c.env.DB.prepare(sql).bind(auth.account.id, project, limit)
    : c.env.DB.prepare(sql).bind(auth.account.id, limit);
  const rows = await stmt.all<Draft>();
  const list = (rows.results ?? []).map((d) => ({ ...d, ...contentUrls(c.env, d.id) }));
  return c.json({ ok: true, drafts: list });
});

// GET /api/drafts/:id — metadata + version list.
drafts.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const draft = await c.env.DB.prepare(
    "SELECT drafts.*, (SELECT v.source_format FROM draft_versions v WHERE v.id = drafts.current_version_id) AS source_format FROM drafts WHERE id = ? AND account_id = ? AND deleted_at IS NULL",
  )
    .bind(id, auth.account.id)
    .first<Draft>();
  if (!draft) return jsonError(c, 404, "E_DRAFT_NOT_FOUND", "Draft not found.");
  const versions = await c.env.DB.prepare(
    "SELECT id, version_number, content_hash, file_size, title, original_filename, cli_version, git_branch, git_commit_sha, git_dirty, source_format, created_at FROM draft_versions WHERE draft_id = ? ORDER BY version_number DESC",
  )
    .bind(id)
    .all();
  return c.json({ ok: true, draft: { ...draft, ...contentUrls(c.env, draft.id) }, versions: versions.results });
});

// PATCH /api/drafts/:id/visibility — make one draft public or private.
// Body: { public: boolean }
//
// Ownership is enforced in the WHERE clause, not by a separate read-then-write: a
// check-then-act pair could be raced, and it would also leak existence (a 403 vs 404
// difference) for a draft the caller does not own. A non-owner gets a plain 404.
drafts.patch("/:id/visibility", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const parsed = await readJsonObject(c);
  if (!parsed.ok) return parsed.response;
  if (typeof parsed.body.public !== "boolean") {
    return jsonError(c, 400, "E_BAD_FIELD", "Field 'public' must be a boolean.");
  }
  const isPublic = parsed.body.public ? 1 : 0;
  const res = await c.env.DB.prepare(
    "UPDATE drafts SET is_public = ?, visibility_changed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND account_id = ? AND deleted_at IS NULL",
  )
    .bind(isPublic, id, auth.account.id)
    .run();
  // D1 reports rows_written; zero means no such draft FOR THIS ACCOUNT.
  if (!res.meta.changes) return jsonError(c, 404, "E_DRAFT_NOT_FOUND", "Draft not found.");
  return c.json({ ok: true, id, public: !!isPublic, ...contentUrls(c.env, id) });
});

// POST /api/drafts/visibility/bulk — apply a visibility to EVERY draft in the account.
// Body: { public: boolean }
//
// This is the explicit "also change my existing drafts" action. It is deliberately a
// SEPARATE call from the account default: flipping a preference must never silently
// rewrite the visibility of links already shared with reviewers. The response reports
// how many rows changed so the UI can say exactly what happened.
drafts.post("/visibility/bulk", async (c) => {
  const auth = c.get("auth");
  const parsed = await readJsonObject(c);
  if (!parsed.ok) return parsed.response;
  if (typeof parsed.body.public !== "boolean") {
    return jsonError(c, 400, "E_BAD_FIELD", "Field 'public' must be a boolean.");
  }
  const isPublic = parsed.body.public ? 1 : 0;
  const res = await c.env.DB.prepare(
    "UPDATE drafts SET is_public = ?, visibility_changed_at = datetime('now'), updated_at = datetime('now') WHERE account_id = ? AND deleted_at IS NULL AND is_public != ?",
  )
    .bind(isPublic, auth.account.id, isPublic)
    .run();
  return c.json({ ok: true, public: !!isPublic, changed: res.meta.changes ?? 0 });
});

// GET /api/drafts/:id/content — stream a draft's bytes to its OWNER.
//
// WHY THIS EXISTS. The content origin is cookie-free by design (it serves
// attacker-controlled HTML, so a session must never be readable there) and therefore
// cannot authorize anyone. A private draft redirects to the dashboard, and the dashboard
// calls THIS endpoint to fetch the bytes with the viewer's credentials.
//
// Query: ?v=<n> for a specific version, ?raw=1 for the exact uploaded source.
drafts.get("/:id/content", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const vParam = c.req.query("v");
  const wantRaw = c.req.query("raw") === "1";

  const draft = await c.env.DB.prepare(
    "SELECT * FROM drafts WHERE id = ? AND account_id = ? AND deleted_at IS NULL",
  )
    .bind(id, auth.account.id)
    .first<Draft>();
  if (!draft) return jsonError(c, 404, "E_DRAFT_NOT_FOUND", "Draft not found.");
  if (draft.disabled_at) {
    return jsonError(c, 451, "E_DISABLED", "This document has been disabled.");
  }

  // Resolve which version to serve. Guard the parse: `parseInt("abc")` is NaN, which
  // would bind as NULL and silently return "not found" for a typo'd version.
  let version;
  if (vParam !== undefined) {
    const n = Number.parseInt(vParam, 10);
    if (!Number.isInteger(n) || n < 1) {
      return jsonError(c, 400, "E_BAD_VERSION", "Query 'v' must be a positive integer.");
    }
    version = await c.env.DB.prepare(
      "SELECT * FROM draft_versions WHERE draft_id = ? AND version_number = ?",
    )
      .bind(id, n)
      .first<DraftVersion>();
  } else {
    version = await c.env.DB.prepare("SELECT * FROM draft_versions WHERE id = ?")
      .bind(draft.current_version_id)
      .first<DraftVersion>();
  }
  if (!version) return jsonError(c, 404, "E_VERSION_NOT_FOUND", "Version not found.");

  const isMd = version.source_format === "md";
  const key = isMd && !wantRaw ? renderedKey(version.object_key) : version.object_key;
  const obj = await c.env.STORAGE.get(key);
  if (!obj) return jsonError(c, 404, "E_CONTENT_UNAVAILABLE", "Content unavailable.");

  // Mirror the content worker's CSP so a private draft is no less sandboxed than a
  // public one. This response carries the document on the DASHBOARD origin, so the
  // policy matters MORE here, not less: without it, untrusted HTML would run in the
  // same origin as the session cookie.
  //
  // sandbox is applied by the embedding page too; this is the defence that survives
  // someone opening the URL directly.
  return new Response(obj.body, {
    status: 200,
    headers: {
      "Content-Type":
        wantRaw && isMd ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8",
      "Content-Security-Policy": [
        "default-src 'none'",
        "img-src https: data:",
        "style-src 'unsafe-inline'",
        "font-src https: data:",
        "media-src https:",
        "script-src 'none'",
        "connect-src 'none'",
        "form-action 'none'",
        "frame-ancestors 'self'",
        "base-uri 'none'",
        // sandbox in the HEADER, not just the iframe attribute: a direct navigation to
        // this URL has no embedding iframe to carry the attribute.
        "sandbox allow-popups",
      ].join("; "),
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      // Never let a shared cache hold a private document: the next requester may be a
      // different principal.
      "Cache-Control": "private, no-store",
      "X-AgentDraft-Draft-Id": draft.id,
      "X-AgentDraft-Version": String(version.version_number),
      "X-AgentDraft-Visibility": draft.is_public ? "public" : "private",
    },
  });
});

// DELETE /api/drafts/:id — soft-delete.
drafts.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const owned = await c.env.DB.prepare(
    "SELECT id FROM drafts WHERE id = ? AND account_id = ? AND deleted_at IS NULL",
  )
    .bind(id, auth.account.id)
    .first<{ id: string }>();
  if (!owned) return jsonError(c, 404, "E_DRAFT_NOT_FOUND", "Draft not found.");
  await c.env.DB.prepare("UPDATE drafts SET deleted_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
  return c.json({ ok: true, deleted: id });
});

export default drafts;
