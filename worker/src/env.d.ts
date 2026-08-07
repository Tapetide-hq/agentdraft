export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  RATELIMIT: KVNamespace;

  // vars
  ENVIRONMENT: string;
  CONTENT_BASE_URL: string;
  DASHBOARD_ORIGIN: string;
  GOOGLE_OAUTH_ENABLED: string;

  // secrets (wrangler secret put)
  BOOTSTRAP_SECRET?: string; // guards the one-time /api/bootstrap
  API_KEY_PEPPER?: string; // domain-separation salt for key hashing
  // OAuth seam — unused in v1, present so the interface is stable
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
