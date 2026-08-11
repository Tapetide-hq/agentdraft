import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.js";
import type { AuthContext } from "./types.js";
import {
  requireAuth,
  requireScope,
  requireGoogleIdentity,
  requireHumanSession,
} from "./middleware/auth.js";
import { rateLimit } from "./middleware/ratelimit.js";
import { jsonError, readJsonObject } from "./lib/http.js";
import uploadRoute from "./routes/upload.js";
import filesRoute from "./routes/files.js";
import bootstrapRoute from "./routes/bootstrap.js";
import sessionRoute from "./routes/session.js";
import keysRoute from "./routes/keys.js";
import projectsRoute from "./routes/projects.js";
import draftsRoute from "./routes/drafts.js";
import googleRoute from "./routes/google.js";

type App = { Bindings: Env; Variables: { auth: AuthContext } };

const app = new Hono<App>();

// CORS: only the dashboard origin may make credentialed requests.
app.use("/api/*", async (c, next) => {
  const origin = c.env.DASHBOARD_ORIGIN;
  return cors({
    origin,
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Bootstrap-Secret"],
  })(c, next);
});

app.get("/", (c) =>
  c.json({
    ok: true,
    service: "agentdraft-api",
    environment: c.env.ENVIRONMENT,
    content_base_url: c.env.CONTENT_BASE_URL,
    google_oauth_enabled: c.env.GOOGLE_OAUTH_ENABLED === "true",
    docs: "https://github.com/Hitesh-Sisara/agentdraft",
  }),
);

app.get("/api/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// Config endpoint the dashboard reads to decide whether to render the (dormant)
// Google button. OAuth is a seam only in v1.
app.get("/api/config", (c) =>
  c.json({
    ok: true,
    google_oauth_enabled: c.env.GOOGLE_OAUTH_ENABLED === "true",
    auth_mode: c.env.AUTH_MODE === "hosted" ? "hosted" : "self-hosted",
    content_base_url: c.env.CONTENT_BASE_URL,
  }),
);

// Bootstrap (secret-guarded, one-time).
app.route("/api/bootstrap", bootstrapRoute);

// Google OAuth sign-in (dormant unless configured; every route 503s otherwise).
app.route("/api/auth/google", googleRoute);

// Session exchange (key -> cookie) and logout.
app.route("/api/session", sessionRoute);

// Upload — auth + upload scope + rate limit (100/hour per key).
app.use("/api/upload", requireAuth(), requireScope("upload"), rateLimit("upload", 100, 3600));
app.route("/api/upload", uploadRoute);

// File lane. The upload stores arbitrary bytes; safety is enforced at SERVE time
// (attachment-default + inline allowlist + nosniff on the content worker), not by
// validating the bytes here. Scope is method-specific: listing needs only `read`, while
// uploading and disabling are mutations that need `upload`. Registered as route-specific
// middleware (Hono matches by path+method) BEFORE app.route so it runs first.
app.use("/api/files/*", requireAuth(), rateLimit("read", 1000, 3600));
app.use("/api/files", requireAuth(), rateLimit("read", 1000, 3600));
app.post("/api/files", requireScope("upload"), rateLimit("upload", 100, 3600));
app.post("/api/files/:id/disable", requireScope("upload"));
app.route("/api/files", filesRoute);

// Identity.
app.get("/api/me", requireAuth(), (c) => {
  const auth = c.get("auth");
  return c.json({
    ok: true,
    account: {
      id: auth.account.id,
      name: auth.account.name,
      email: auth.account.email,
      is_owner: !!auth.account.is_owner,
      // Default visibility for NEW drafts. Surfaced here so both the CLI (`whoami`) and
      // the dashboard read one source of truth rather than each keeping a local guess.
      default_draft_public: auth.account.default_draft_public !== 0,
    },
    via: auth.via,
    scopes: auth.scopes,
  });
});

// PATCH /api/me/settings — account preferences.
// Body: { default_draft_public: boolean }
//
// Changing this affects FUTURE drafts only. Existing drafts are untouched, because
// silently flipping links already shared with reviewers is the one behaviour a
// visibility preference must never have. The bulk endpoint is the explicit opt-in.
app.patch("/api/me/settings", requireAuth(), requireScope("upload"), async (c) => {
  const auth = c.get("auth");
  const parsed = await readJsonObject(c);
  if (!parsed.ok) return parsed.response;
  if (typeof parsed.body.default_draft_public !== "boolean") {
    return jsonError(
      c,
      400,
      "E_BAD_FIELD",
      "Field 'default_draft_public' must be a boolean.",
    );
  }
  const val = parsed.body.default_draft_public ? 1 : 0;
  await c.env.DB.prepare(
    "UPDATE accounts SET default_draft_public = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(val, auth.account.id)
    .run();
  return c.json({ ok: true, default_draft_public: !!val });
});

// Read APIs — auth + read scope + generous rate limit (1000/hour).
app.use("/api/projects/*", requireAuth(), rateLimit("read", 1000, 3600));
app.use("/api/projects", requireAuth(), rateLimit("read", 1000, 3600));
app.route("/api/projects", projectsRoute);

app.use("/api/drafts/*", requireAuth(), rateLimit("read", 1000, 3600));
app.use("/api/drafts", requireAuth(), rateLimit("read", 1000, 3600));
// Visibility is a MUTATION, so it needs more than the read scope every draft route
// carries. "upload" is the write capability a machine key already holds, which keeps the
// CLI able to publish privately without granting it account administration ("manage").
//
// Registered BEFORE app.route so these run as route-specific middleware. Hono matches
// middleware by path, so the bulk route must be listed explicitly — "/api/drafts/*"
// above already covers it for auth, but the scope gate has to name each mutation.
app.patch("/api/drafts/:id/visibility", requireScope("upload"));
app.post("/api/drafts/visibility/bulk", requireScope("upload"));
app.route("/api/drafts", draftsRoute);

// API key management requires the "manage" scope. This blocks an upload/read key
// from escalating to mint new keys, while allowing a manage-scoped key (or a dashboard
// session, which carries manage) to administer keys. The dashboard uses a BFF that
// holds a manage key server-side; /api/session remains a valid alternative integration.
// Key management is DASHBOARD-ONLY in hosted mode: requireHumanSession rejects API-key
// bearer auth outright, so a machine credential can publish but never administer the
// account. On a self-hosted instance with no IdP these middlewares no-op, keeping that
// deployment usable.
app.use("/api/api-keys/*", requireAuth(), requireScope("manage"), requireHumanSession(), rateLimit("read", 1000, 3600));
app.use("/api/api-keys", requireAuth(), requireScope("manage"), requireHumanSession(), rateLimit("read", 1000, 3600));
// Minting additionally requires a verified Google identity, and FAILS CLOSED in hosted
// mode if OAuth is misconfigured rather than silently accepting a key.
app.post("/api/api-keys", requireGoogleIdentity());
app.route("/api/api-keys", keysRoute);

// 404 + error envelopes.
app.notFound((c) => jsonError(c, 404, "E_NOT_FOUND", "No such route."));
app.onError((err, c) => {
  console.error("unhandled error:", err instanceof Error ? err.stack : String(err));
  return jsonError(c, 500, "E_INTERNAL", "Internal error.");
});

export default app;
