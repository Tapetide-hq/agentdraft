// Bindings are NOT hand-written: `wrangler types` generates them into
// worker-configuration.d.ts as the global `Env` (from wrangler.jsonc). We extend that
// generated type with the secrets (set via `wrangler secret put`), which wrangler
// cannot know about. If a binding is added/renamed in wrangler.jsonc, rerun
// `wrangler types` and any drift becomes a compile error instead of a runtime crash.
//
// Secrets are optional at the type level because a fresh deploy may not have them set
// yet; the code checks for their presence and fails closed (e.g. bootstrap returns 503).

import type {} from "../worker-configuration.js";

export interface WebHostSecrets {
  BOOTSTRAP_SECRET?: string; // guards the one-time /api/bootstrap
  API_KEY_PEPPER?: string; // domain-separation salt for API key hashing
  // OAuth seam — unused in v1, declared so the interface is stable for later work.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

// `wrangler types` narrows plain vars to the LITERAL value currently in
// wrangler.jsonc (e.g. GOOGLE_OAUTH_ENABLED: "false"), which makes a legitimate
// runtime comparison against "true" a compile error even though the value is meant to
// be reconfigured per deployment. Widen the configurable vars back to string; the
// binding types (D1/R2/KV) stay exactly as generated.
type ConfigurableVars = "ENVIRONMENT" | "CONTENT_BASE_URL" | "DASHBOARD_ORIGIN" | "GOOGLE_OAUTH_ENABLED";

export type Env = Omit<globalThis.Env, ConfigurableVars> &
  Record<ConfigurableVars, string> &
  WebHostSecrets;
