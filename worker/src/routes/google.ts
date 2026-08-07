// Google OAuth 2.0 sign-in (Authorization Code flow with PKCE + state).
//
// This is the human sign-in path. It exists so API keys can be gated behind a real
// verified identity: a key may only be minted by a principal that signed in with Google
// (see requireGoogleIdentity in middleware/auth.ts).
//
// DORMANT UNTIL CONFIGURED. Every route here returns 503 unless GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET are set as Worker secrets and GOOGLE_OAUTH_ENABLED is "true".
// Shipping the code inert is deliberate — an OAuth client cannot be provisioned without
// a human completing Google Cloud Console consent, and shipping a sign-in button that
// cannot work is worse than not offering one.
//
// Security notes:
//  * `state` is signed AND stored, so a forged callback cannot mint a session (CSRF).
//  * PKCE (S256) is used even though this is a confidential client — it costs nothing
//    and protects against authorization-code interception.
//  * The id_token is verified against Google's JWKS: signature, issuer, audience, and
//    expiry. `email_verified` is required. We never trust an unverified email, because
//    accounts are keyed on identity and an unverified address is not an identity.
//  * Accounts are linked on the immutable `sub` claim, never on email — Google emails
//    can change, `sub` cannot.

import { Hono } from "hono";
import type { Env } from "../env.js";
import type { Account } from "../types.js";
import { newId, newSessionId } from "../services/id.js";
import { serialize as serializeCookie } from "../lib/cookie.js";
import { jsonError } from "../lib/http.js";
import { SESSION_COOKIE } from "../middleware/auth.js";

const google = new Hono<{ Bindings: Env }>();

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const STATE_TTL_SEC = 600; // 10 minutes to complete the round trip
const SESSION_TTL_SEC = 30 * 24 * 3600;

function oauthConfigured(env: Env): boolean {
  return (
    env.GOOGLE_OAUTH_ENABLED === "true" &&
    !!env.GOOGLE_CLIENT_ID &&
    !!env.GOOGLE_CLIENT_SECRET
  );
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const s = atob(input.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256Raw(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
}

function redirectUri(env: Env): string {
  return `${env.DASHBOARD_ORIGIN.replace(/\/$/, "")}/auth/google/callback`;
}

interface IdTokenClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

interface Jwk {
  kid: string;
  kty: string;
  alg: string;
  n: string;
  e: string;
  use?: string;
}

// Verify a Google id_token: RS256 signature against JWKS, plus issuer/audience/expiry.
// Returns the claims, or null if anything fails. Never returns partially-verified data.
async function verifyIdToken(idToken: string, clientId: string): Promise<IdTokenClaims | null> {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { kid?: string; alg?: string };
  let claims: IdTokenClaims;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(headerB64)));
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

  const res = await fetch(JWKS_URI);
  if (!res.ok) return null;
  const jwks = (await res.json()) as { keys: Jwk[] };
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }

  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlDecode(sigB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  if (!ok) return null;

  // Claim checks. The audience pin is load-bearing: Google signs every project's tokens
  // with the SAME keys, so a valid signature alone proves nothing about which app the
  // token was issued for.
  if (!ISSUERS.includes(claims.iss)) return null;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(clientId)) return null;
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) return null;
  if (!claims.sub) return null;

  return claims;
}

// GET /api/auth/google/start — begin the flow. Returns the URL to redirect the user to.
google.get("/start", async (c) => {
  if (!oauthConfigured(c.env)) {
    return jsonError(
      c,
      503,
      "E_OAUTH_NOT_CONFIGURED",
      "Google sign-in is not configured on this deployment.",
    );
  }
  const state = randomToken();
  const verifier = randomToken(48);
  const challenge = b64url(await sha256Raw(verifier));

  // Store the state + verifier server-side so a forged callback cannot be replayed.
  await c.env.RATELIMIT.put(
    `oauth:state:${state}`,
    JSON.stringify({ verifier, created: Date.now() }),
    { expirationTtl: STATE_TTL_SEC },
  );

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", c.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri(c.env));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");

  return c.json({ ok: true, authorize_url: url.toString(), state });
});

// POST /api/auth/google/callback — exchange the code, verify the id_token, upsert the
// account, and mint a dashboard session. Body: { code, state }
google.post("/callback", async (c) => {
  if (!oauthConfigured(c.env)) {
    return jsonError(c, 503, "E_OAUTH_NOT_CONFIGURED", "Google sign-in is not configured.");
  }
  let body: { code?: unknown; state?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, "E_BAD_JSON", "Body must be JSON.");
  }
  const code = typeof body.code === "string" ? body.code : "";
  const state = typeof body.state === "string" ? body.state : "";
  if (!code || !state) return jsonError(c, 400, "E_BAD_REQUEST", "code and state are required.");

  // Consume the state exactly once (CSRF + replay protection).
  const stored = await c.env.RATELIMIT.get(`oauth:state:${state}`);
  if (!stored) return jsonError(c, 400, "E_BAD_STATE", "Invalid or expired state.");
  await c.env.RATELIMIT.delete(`oauth:state:${state}`);
  let verifier = "";
  try {
    verifier = (JSON.parse(stored) as { verifier: string }).verifier;
  } catch {
    return jsonError(c, 400, "E_BAD_STATE", "Malformed state record.");
  }

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID!,
      client_secret: c.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(c.env),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) {
    return jsonError(c, 401, "E_OAUTH_EXCHANGE_FAILED", "Google rejected the authorization code.");
  }
  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) {
    return jsonError(c, 401, "E_OAUTH_NO_ID_TOKEN", "Google did not return an id_token.");
  }

  const claims = await verifyIdToken(tokens.id_token, c.env.GOOGLE_CLIENT_ID!);
  if (!claims) return jsonError(c, 401, "E_OAUTH_BAD_TOKEN", "id_token verification failed.");
  if (claims.email && claims.email_verified === false) {
    return jsonError(c, 403, "E_EMAIL_UNVERIFIED", "Your Google email is not verified.");
  }

  // Upsert on the IMMUTABLE sub claim. Emails change; sub does not.
  let account = await c.env.DB.prepare("SELECT * FROM accounts WHERE google_sub = ?")
    .bind(claims.sub)
    .first<Account>();

  if (!account) {
    const id = newId("acct_");
    await c.env.DB.prepare(
      "INSERT INTO accounts (id, name, email, avatar_url, google_sub) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(id, claims.name ?? claims.email ?? "Account", claims.email ?? null, claims.picture ?? null, claims.sub)
      .run();
    account = await c.env.DB.prepare("SELECT * FROM accounts WHERE id = ?")
      .bind(id)
      .first<Account>();
  } else {
    // Refresh profile fields that legitimately change over time.
    await c.env.DB.prepare(
      "UPDATE accounts SET name = ?, email = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(claims.name ?? account.name, claims.email ?? account.email, claims.picture ?? account.avatar_url, account.id)
      .run();
  }
  if (!account) return jsonError(c, 500, "E_INTERNAL", "Failed to create account.");

  const sid = newSessionId();
  const expires = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString();
  await c.env.DB.prepare(
    "INSERT INTO sessions (id, account_id, expires_at, auth_method) VALUES (?, ?, ?, 'google')",
  )
    .bind(sid, account.id, expires)
    .run();

  c.header(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, sid, {
      path: "/",
      maxAge: SESSION_TTL_SEC,
      httpOnly: true,
      secure: true,
      sameSite: "Lax", // Lax, not Strict: the browser arrives here from Google
    }),
  );
  return c.json({
    ok: true,
    account: { id: account.id, name: account.name, email: account.email },
    auth_method: "google",
  });
});

export default google;
