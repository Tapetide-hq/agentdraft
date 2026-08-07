import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { apiFetch } from "$lib/server/api";

// GET /auth/google — kick off Google sign-in.
//
// The BFF asks the API for the authorize URL (the API owns the client id, PKCE verifier
// and state) and then redirects the browser to Google. The dashboard never handles the
// client secret.
export const GET: RequestHandler = async ({ locals }) => {
  const res = await apiFetch(
    { apiBase: locals.apiBase, apiKey: null, service: locals.apiService },
    "/api/auth/google/start",
  );
  if (!res.ok) {
    // Not configured on this deployment — send the user back to the key-paste flow
    // rather than showing a broken screen.
    throw redirect(303, "/login?google=unavailable");
  }
  const data = (await res.json()) as { authorize_url?: string };
  if (!data.authorize_url) throw redirect(303, "/login?google=unavailable");
  throw redirect(303, data.authorize_url);
};
