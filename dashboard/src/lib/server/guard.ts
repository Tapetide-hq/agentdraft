import { redirect } from "@sveltejs/kit";
import type { ApiCtx } from "./api";

// Require an authenticated BFF session; returns the ApiCtx or redirects to /login.
// Authenticated via EITHER a pasted API key or a Google-backed session.
export function requireKey(locals: App.Locals): ApiCtx {
  if (!locals.apiKey && !locals.sessionId) throw redirect(303, "/login");
  return {
    apiBase: locals.apiBase,
    apiKey: locals.apiKey,
    sessionId: locals.sessionId,
    service: locals.apiService,
  };
}
