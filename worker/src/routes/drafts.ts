import { Hono } from "hono";
import type { Env } from "../env.js";
import type { AuthContext, Draft } from "../types.js";
import { jsonError } from "../lib/http.js";

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
  const sql = project
    ? "SELECT * FROM drafts WHERE account_id = ? AND project_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?"
    : "SELECT * FROM drafts WHERE account_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?";
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
    "SELECT * FROM drafts WHERE id = ? AND account_id = ? AND deleted_at IS NULL",
  )
    .bind(id, auth.account.id)
    .first<Draft>();
  if (!draft) return jsonError(c, 404, "E_DRAFT_NOT_FOUND", "Draft not found.");
  const versions = await c.env.DB.prepare(
    "SELECT id, version_number, content_hash, file_size, title, original_filename, cli_version, git_branch, git_commit_sha, git_dirty, created_at FROM draft_versions WHERE draft_id = ? ORDER BY version_number DESC",
  )
    .bind(id)
    .all();
  return c.json({ ok: true, draft: { ...draft, ...contentUrls(c.env, draft.id) }, versions: versions.results });
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
