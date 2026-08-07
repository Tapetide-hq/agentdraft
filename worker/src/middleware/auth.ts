import type { Context, Next } from "hono";
import type { Env } from "../env.js";
import type { Account, ApiKeyRow, SessionRow, AuthContext } from "../types.js";
import { hashApiKey } from "../services/crypto.js";
import { jsonError } from "../lib/http.js";
import { parse as parseCookie } from "../lib/cookie.js";

const SESSION_COOKIE = "__Host-agentdraft_session";

// Resolve the principal from either a bearer API key or a session cookie.
// Returns null (does not throw) if unauthenticated; middleware decides what to do.
type Ctx = Context<{ Bindings: Env; Variables: { auth: AuthContext } }>;

async function resolveAuth(c: Ctx): Promise<AuthContext | null> {
  const authz = c.req.header("authorization");
  if (authz?.startsWith("Bearer ")) {
    const key = authz.slice(7).trim();
    if (!key.startsWith("ad_")) return null;
    const pepper = c.env.API_KEY_PEPPER ?? "";
    const hash = await hashApiKey(key, pepper);
    const row = await c.env.DB.prepare(
      "SELECT * FROM api_keys WHERE key_hash = ?",
    )
      .bind(hash)
      .first<ApiKeyRow>();
    if (!row) return null;
    if (row.revoked_at) return null;
    if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
    const account = await c.env.DB.prepare("SELECT * FROM accounts WHERE id = ?")
      .bind(row.account_id)
      .first<Account>();
    if (!account) return null;
    // best-effort last_used bump (don't block the request on it)
    c.executionCtx.waitUntil(
      c.env.DB.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?")
        .bind(row.id)
        .run(),
    );
    return {
      account,
      via: "key",
      keyId: row.id,
      scopes: row.scopes.split(",").map((s) => s.trim()).filter(Boolean),
      authMethod: "key",
    };
  }

  // session cookie
  const cookies = parseCookie(c.req.header("cookie") ?? "");
  const sid = cookies[SESSION_COOKIE];
  if (sid) {
    const sess = await c.env.DB.prepare("SELECT * FROM sessions WHERE id = ?")
      .bind(sid)
      .first<SessionRow>();
    if (!sess || sess.revoked_at) return null;
    if (new Date(sess.expires_at) < new Date()) return null;
    const account = await c.env.DB.prepare("SELECT * FROM accounts WHERE id = ?")
      .bind(sess.account_id)
      .first<Account>();
    if (!account) return null;
    return {
      account,
      via: "session",
      scopes: ["upload", "read", "manage"],
      authMethod: sess.auth_method === "google" ? "google" : "key",
    };
  }

  return null;
}

// Require any authenticated principal.
export function requireAuth() {
  return async (c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>, next: Next) => {
    const auth = await resolveAuth(c);
    if (!auth) return jsonError(c, 401, "E_UNAUTHENTICATED", "Missing or invalid credentials.");
    c.set("auth", auth);
    await next();
  };
}

// Require a specific scope (checked after requireAuth populated c.var.auth).
export function requireScope(scope: string) {
  return async (c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>, next: Next) => {
    const auth = c.get("auth");
    if (!auth) return jsonError(c, 401, "E_UNAUTHENTICATED", "Not authenticated.");
    if (!auth.scopes.includes(scope) && !auth.scopes.includes("manage")) {
      return jsonError(c, 403, "E_FORBIDDEN", `Requires scope "${scope}".`);
    }
    await next();
  };
}

// Require a session (dashboard-only, management) principal — not an API key.
export function requireSession() {
  return async (c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>, next: Next) => {
    const auth = await resolveAuth(c);
    if (!auth) return jsonError(c, 401, "E_UNAUTHENTICATED", "Not signed in.");
    if (auth.via !== "session") {
      return jsonError(c, 403, "E_SESSION_REQUIRED", "This endpoint requires a dashboard session.");
    }
    c.set("auth", auth);
    await next();
  };
}


// Require a VERIFIED GOOGLE IDENTITY, not merely a valid credential.
//
// Minting an API key is the one operation that creates durable new access, so it must
// not be reachable with a credential that could itself have leaked. An API key (even a
// manage-scoped one) is a bearer token that may sit in CI config, a dotfile, or an
// agent's environment; if a leaked key could mint more keys, revoking the leaked one
// would not contain the breach. Requiring a Google-backed session means an attacker
// needs the human's Google account, which we do not hold and cannot leak.
//
// When Google OAuth is NOT configured on a deployment this gate is DISABLED, otherwise a
// self-hosted instance without an IdP could never mint a key and would be bricked. The
// gate is therefore only as strong as the deployment's configuration, which is stated
// plainly in SECURITY.md rather than implied to be absolute.
export function requireGoogleIdentity() {
  return async (c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>, next: Next) => {
    const oauthOn =
      c.env.GOOGLE_OAUTH_ENABLED === "true" && !!c.env.GOOGLE_CLIENT_ID && !!c.env.GOOGLE_CLIENT_SECRET;
    if (!oauthOn) {
      await next();
      return;
    }
    const auth = c.get("auth");
    if (!auth) return jsonError(c, 401, "E_UNAUTHENTICATED", "Not authenticated.");
    if (auth.authMethod !== "google") {
      return jsonError(
        c,
        403,
        "E_GOOGLE_SIGNIN_REQUIRED",
        "Creating API keys requires signing in with Google.",
      );
    }
    await next();
  };
}

export { SESSION_COOKIE, resolveAuth };
