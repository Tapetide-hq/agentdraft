import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { apiFetch } from "$lib/server/api";

// GET /auth/google/callback — Google redirects the browser back here with ?code&state.
//
// The BFF forwards them to the API, which verifies the id_token and mints a session. The
// API's Set-Cookie is for the API origin, so we re-issue the session cookie on THIS
// origin: the dashboard authenticates against the API with that value on every request.
export const GET: RequestHandler = async ({ url, locals, cookies }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  // The user declined consent, or Google refused. Not an error worth a stack trace.
  if (err) throw redirect(303, `/login?google=${encodeURIComponent(err)}`);
  if (!code || !state) throw redirect(303, "/login?google=missing_code");

  const res = await apiFetch(
    { apiBase: locals.apiBase, apiKey: null, service: locals.apiService },
    "/api/auth/google/callback",
    { method: "POST", body: JSON.stringify({ code, state }) },
  );
  if (!res.ok) throw redirect(303, "/login?google=failed");

  // Extract the session id the API just minted and bind it to this origin.
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/__Host-agentdraft_session=([^;]+)/);
  if (!m) throw redirect(303, "/login?google=nosession");

  cookies.set("ad_session", decodeURIComponent(m[1]), {
    path: "/",
    httpOnly: true,
    secure: true,
    // Lax, not Strict: the browser arrives here as a cross-site navigation from Google,
    // and a Strict cookie would not be sent on that first request.
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  throw redirect(303, "/dashboard");
};
