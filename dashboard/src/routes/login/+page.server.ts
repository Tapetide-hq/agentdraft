import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { apiFetch } from "$lib/server/api";
import { safeNext } from "$lib/server/next";

// Ask the API whether Google OAuth is configured on this deployment. The button is
// rendered only when it is genuinely usable — showing a dead sign-in button is worse
// than not offering it.
export const load: PageServerLoad = async ({ locals, url }) => {
  const googleError = url.searchParams.get("google");
  // Where to land after sign-in. Validated here rather than at use time so a hostile
  // value never reaches the page or a Location header.
  const next = safeNext(url.searchParams.get("next"));
  try {
    const res = await apiFetch(
      { apiBase: locals.apiBase, apiKey: null, service: locals.apiService },
      "/api/config",
    );
    if (res.ok) {
      const cfg = (await res.json()) as {
        google_oauth_enabled?: boolean;
        auth_mode?: string;
      };
      return {
        googleEnabled: !!cfg.google_oauth_enabled,
        // hosted => Google is the ONLY door; the key-paste form is not rendered at all.
        hosted: cfg.auth_mode === "hosted",
        googleError,
        next,
      };
    }
  } catch {
    /* config is advisory; fall back to key-only sign-in */
  }
  return { googleEnabled: false, hosted: false, googleError, next };
};

export const actions: Actions = {
  default: async ({ request, cookies, locals, url }) => {
    // Hiding the form is not enforcement — a hand-crafted POST must be refused too.
    // The API rejects this as well; this is defence in depth at the BFF boundary.
    try {
      const cfgRes = await apiFetch(
        { apiBase: locals.apiBase, apiKey: null, service: locals.apiService },
        "/api/config",
      );
      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as { auth_mode?: string };
        if (cfg.auth_mode === "hosted") {
          return fail(403, { message: "Sign in with Google. API-key sign-in is disabled here." });
        }
      }
    } catch {
      /* config is advisory; the API enforces the same rule regardless */
    }

    const form = await request.formData();
    const key = String(form.get("api_key") ?? "").trim();
    if (!key.startsWith("ad_")) {
      return fail(400, { message: "Enter a valid ad_ API key." });
    }
    // Verify the key against the API before storing it in a cookie.
    const res = await apiFetch(
      { apiBase: locals.apiBase, apiKey: key, service: locals.apiService },
      "/api/me",
    );
    if (!res.ok) {
      return fail(401, { message: "Key is invalid, revoked, or expired." });
    }
    // Store server-side only: httpOnly, Secure, SameSite=Strict, on our own origin.
    cookies.set("ad_key", key, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 30,
    });
    // Return the viewer to the document they originally asked for. safeNext collapses
    // anything hostile or off-origin to /dashboard, so this cannot become an open
    // redirect even though the value arrives in a query string.
    throw redirect(303, safeNext(url.searchParams.get("next")));
  },
};
