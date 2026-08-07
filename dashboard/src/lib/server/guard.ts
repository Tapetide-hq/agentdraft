import { redirect } from "@sveltejs/kit";
import type { ApiCtx } from "./api";

// Require an authenticated BFF session; returns the ApiCtx or redirects to /login.
export function requireKey(locals: App.Locals): ApiCtx {
  if (!locals.apiKey) throw redirect(303, "/login");
  return { apiBase: locals.apiBase, apiKey: locals.apiKey, service: locals.apiService };
}
