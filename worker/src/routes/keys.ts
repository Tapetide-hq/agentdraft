import { Hono } from "hono";
import type { Env } from "../env.js";
import type { ApiKeyRow, AuthContext } from "../types.js";
import { newId, newApiKey } from "../services/id.js";
import { hashApiKey } from "../services/crypto.js";
import { jsonError, readJsonObject, badStringField } from "../lib/http.js";

const keys = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

// GET /api/api-keys — list (never returns hashes or full keys).
keys.get("/", async (c) => {
  const auth = c.get("auth");
  const rows = await c.env.DB.prepare(
    "SELECT id, name, key_prefix, scopes, last_used_at, revoked_at, expires_at, created_at FROM api_keys WHERE account_id = ? ORDER BY created_at DESC",
  )
    .bind(auth.account.id)
    .all();
  return c.json({ ok: true, keys: rows.results });
});

// POST /api/api-keys — create; returns plaintext ONCE.
keys.post("/", async (c) => {
  const auth = c.get("auth");
  const parsedBody = await readJsonObject(c, { allowEmpty: true });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
  const badField = badStringField(c, body, ["name"]);
  if (badField) return badField;
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "cli";
  const requested = Array.isArray(body.scopes) ? (body.scopes as string[]) : ["upload", "read"];
  const allowed = new Set(["upload", "read", "manage"]);
  const scopes = requested.filter((s) => allowed.has(s));
  if (scopes.length === 0) scopes.push("upload", "read");

  const keyId = newId("key_");
  const { full, prefix } = newApiKey();
  const hash = await hashApiKey(full, c.env.API_KEY_PEPPER ?? "");
  await c.env.DB.prepare(
    "INSERT INTO api_keys (id, account_id, name, key_prefix, key_hash, scopes) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(keyId, auth.account.id, name, prefix, hash, scopes.join(","))
    .run();
  return c.json(
    { ok: true, key_id: keyId, name, key_prefix: prefix, scopes, api_key: full, note: "Shown once." },
    201,
  );
});

// DELETE /api/api-keys/:id — revoke.
keys.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT id FROM api_keys WHERE id = ? AND account_id = ?")
    .bind(id, auth.account.id)
    .first<{ id: string }>();
  if (!row) return jsonError(c, 404, "E_KEY_NOT_FOUND", "Key not found.");
  await c.env.DB.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
  return c.json({ ok: true, revoked: id });
});

export default keys;
