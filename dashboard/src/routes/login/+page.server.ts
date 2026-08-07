import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { apiFetch } from "$lib/server/api";

// Ask the API whether Google OAuth is configured on this deployment. The button is
// rendered only when it is genuinely usable — showing a dead sign-in button is worse
// than not offering it.
export const load: PageServerLoad = async ({ locals }) => {
  try {
    const res = await apiFetch(
      { apiBase: locals.apiBase, apiKey: null, service: locals.apiService },
      "/api/config",
    );
    if (res.ok) {
      const cfg = (await res.json()) as { google_oauth_enabled?: boolean };
      return { googleEnabled: !!cfg.google_oauth_enabled };
    }
  } catch {
    /* config is advisory; fall back to key-only sign-in */
  }
  return { googleEnabled: false };
};

export const actions: Actions = {
  default: async ({ request, cookies, locals }) => {
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
    throw redirect(303, "/dashboard");
  },
};
