import { Hono } from "hono";
import type { Env } from "../env.js";
import type { AuthContext } from "../types.js";
import { newId } from "../services/id.js";
import { jsonError } from "../lib/http.js";

const projects = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

// GET /api/projects
projects.get("/", async (c) => {
  const auth = c.get("auth");
  const rows = await c.env.DB.prepare(
    "SELECT * FROM projects WHERE account_id = ? AND archived_at IS NULL ORDER BY updated_at DESC",
  )
    .bind(auth.account.id)
    .all();
  return c.json({ ok: true, projects: rows.results });
});

// POST /api/projects  { name, description?, repo_url? }
projects.post("/", async (c) => {
  const auth = c.get("auth");
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, "E_BAD_JSON", "Body must be JSON.");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError(c, 400, "E_NO_NAME", "Field 'name' is required.");
  const id = newId("proj_", 12);
  await c.env.DB.prepare(
    "INSERT INTO projects (id, account_id, name, description, repo_url) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      auth.account.id,
      name,
      typeof body.description === "string" ? body.description : null,
      typeof body.repo_url === "string" ? body.repo_url : null,
    )
    .run();
  const proj = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
  return c.json({ ok: true, project: proj }, 201);
});

// PATCH /api/projects/:id
projects.patch("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const owned = await c.env.DB.prepare("SELECT id FROM projects WHERE id = ? AND account_id = ?")
    .bind(id, auth.account.id)
    .first<{ id: string }>();
  if (!owned) return jsonError(c, 404, "E_PROJECT_NOT_FOUND", "Project not found.");
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, "E_BAD_JSON", "Body must be JSON.");
  }
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const f of ["name", "description", "repo_url"]) {
    if (typeof body[f] === "string") {
      fields.push(`${f} = ?`);
      vals.push(body[f]);
    }
  }
  if (fields.length === 0) return jsonError(c, 400, "E_NO_FIELDS", "No updatable fields.");
  vals.push(id);
  await c.env.DB.prepare(
    `UPDATE projects SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(...vals)
    .run();
  const proj = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
  return c.json({ ok: true, project: proj });
});

// DELETE /api/projects/:id — archive.
projects.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const owned = await c.env.DB.prepare("SELECT id FROM projects WHERE id = ? AND account_id = ?")
    .bind(id, auth.account.id)
    .first<{ id: string }>();
  if (!owned) return jsonError(c, 404, "E_PROJECT_NOT_FOUND", "Project not found.");
  await c.env.DB.prepare("UPDATE projects SET archived_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
  return c.json({ ok: true, archived: id });
});

export default projects;
