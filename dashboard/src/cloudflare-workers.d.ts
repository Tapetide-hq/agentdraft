// Adapter 8 no longer passes `event.platform`; the Worker's bindings and vars are read from
// the `cloudflare:workers` module instead (emulated from wrangler.jsonc under `vite dev`).
// Only the members the dashboard uses are declared, so no @cloudflare/workers-types needed.
declare module "cloudflare:workers" {
  export const env: {
    API_BASE_URL?: string;
    CONTENT_BASE_URL?: string;
    // Service binding to the API worker (wrangler.jsonc `services`).
    API?: { fetch(input: Request): Promise<Response> };
  };
}
