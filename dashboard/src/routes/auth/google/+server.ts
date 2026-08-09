import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { apiFetch } from "$lib/server/api";
import { safeNext } from "$lib/server/next";

// GET /auth/google — kick off Google sign-in.
//
// The BFF asks the API for the authorize URL (the API owns the client id, PKCE verifier
// and state) and then redirects the browser to Google. The dashboard never handles the
// client secret.
export const GET: RequestHandler = async ({ locals, url, cookies }) => {
  // Carry the return-to path across the Google round trip.
  //
  // It is stashed in a short-lived httpOnly cookie rather than appended to the OAuth
  // `state`: `state` is minted and verified by the API, and stuffing caller-controlled
  // data into it would mean the API has to parse and re-trust a value that exists purely
  // for CSRF. Keeping `next` on the dashboard origin keeps that boundary clean.
  //
  // Validated on the way IN as well as on the way out. Storing a hostile value and
  // sanitising later means one missed read is an open redirect.
  const next = safeNext(url.searchParams.get("next"), "");
  if (next) {
    cookies.set("ad_next", next, {
      path: "/",
      httpOnly: true,
      secure: true,
      // Lax: the browser returns from Google as a cross-site navigation, and a Strict
      // cookie would not be sent on that first request.
      sameSite: "lax",
      maxAge: 600, // 10 minutes — long enough to sign in, short enough not to linger
    });
  } else {
    // Clear any stale value so an earlier attempt cannot hijack this sign-in.
    cookies.delete("ad_next", { path: "/" });
  }

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
