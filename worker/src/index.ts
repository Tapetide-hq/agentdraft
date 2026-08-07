import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.js";
import type { AuthContext } from "./types.js";
import { requireAuth, requireScope, requireGoogleIdentity } from "./middleware/auth.js";
import { rateLimit } from "./middleware/ratelimit.js";
import { jsonError } from "./lib/http.js";
import uploadRoute from "./routes/upload.js";
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
    },
    via: auth.via,
    scopes: auth.scopes,
  });
});

// Read APIs — auth + read scope + generous rate limit (1000/hour).
app.use("/api/projects/*", requireAuth(), rateLimit("read", 1000, 3600));
app.use("/api/projects", requireAuth(), rateLimit("read", 1000, 3600));
app.route("/api/projects", projectsRoute);

app.use("/api/drafts/*", requireAuth(), rateLimit("read", 1000, 3600));
app.use("/api/drafts", requireAuth(), rateLimit("read", 1000, 3600));
app.route("/api/drafts", draftsRoute);

// API key management requires the "manage" scope. This blocks an upload/read key
// from escalating to mint new keys, while allowing a manage-scoped key (or a dashboard
// session, which carries manage) to administer keys. The dashboard uses a BFF that
// holds a manage key server-side; /api/session remains a valid alternative integration.
app.use("/api/api-keys/*", requireAuth(), requireScope("manage"), rateLimit("read", 1000, 3600));
app.use("/api/api-keys", requireAuth(), requireScope("manage"), rateLimit("read", 1000, 3600));
// Minting a key is the only operation that creates durable NEW access, so it carries an
// extra gate: a verified Google identity. Listing and revoking deliberately do NOT —
// you must always be able to revoke a key, including when your IdP is unavailable.
app.post("/api/api-keys", requireGoogleIdentity());
app.route("/api/api-keys", keysRoute);

// 404 + error envelopes.
app.notFound((c) => jsonError(c, 404, "E_NOT_FOUND", "No such route."));
app.onError((err, c) => {
  console.error("unhandled error:", err instanceof Error ? err.stack : String(err));
  return jsonError(c, 500, "E_INTERNAL", "Internal error.");
});

export default app;
