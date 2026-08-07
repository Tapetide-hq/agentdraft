import { Hono } from "hono";
import type { Env } from "../env.js";
import type { Account, ApiKeyRow, AuthContext } from "../types.js";
import { hashApiKey } from "../services/crypto.js";
import { newSessionId } from "../services/id.js";
import { serialize as serializeCookie } from "../lib/cookie.js";
import { jsonError, readJsonObject, badStringField } from "../lib/http.js";
import { SESSION_COOKIE } from "../middleware/auth.js";

const session = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

const SESSION_TTL_SEC = 30 * 24 * 3600; // 30 days

// POST /api/session — exchange a pasted scoped API key for a dashboard session.
// Body: { api_key }
session.post("/", async (c) => {
  const parsedBody = await readJsonObject(c);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
  const badField = badStringField(c, body, ["api_key"]);
  if (badField) return badField;
  const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
  if (!apiKey.startsWith("wh_")) {
    return jsonError(c, 400, "E_BAD_KEY", "Provide a valid wh_ API key.");
  }
  const hash = await hashApiKey(apiKey, c.env.API_KEY_PEPPER ?? "");
  const row = await c.env.DB.prepare("SELECT * FROM api_keys WHERE key_hash = ?")
    .bind(hash)
    .first<ApiKeyRow>();
  if (!row || row.revoked_at || (row.expires_at && new Date(row.expires_at) < new Date())) {
    return jsonError(c, 401, "E_INVALID_KEY", "Key is invalid, revoked, or expired.");
  }
  const account = await c.env.DB.prepare("SELECT * FROM accounts WHERE id = ?")
    .bind(row.account_id)
    .first<Account>();
  if (!account) return jsonError(c, 401, "E_INVALID_KEY", "Account not found.");

  const sid = newSessionId();
  const expires = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString();
  await c.env.DB.prepare(
    "INSERT INTO sessions (id, account_id, expires_at) VALUES (?, ?, ?)",
  )
    .bind(sid, account.id, expires)
    .run();

  // __Host- prefix requires Secure, Path=/, and no Domain. SameSite=Strict.
  c.header(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, sid, {
      path: "/",
      maxAge: SESSION_TTL_SEC,
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
    }),
  );
  return c.json({ ok: true, account: { id: account.id, name: account.name, email: account.email } });
});

// DELETE /api/session — logout (revoke current session).
session.delete("/", async (c) => {
  const cookie = c.req.header("cookie") ?? "";
  const m = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (m) {
    await c.env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?")
      .bind(decodeURIComponent(m[1]))
      .run();
  }
  c.header(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
    }),
  );
  return c.json({ ok: true });
});

export default session;
