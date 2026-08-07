import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { apiFetch } from "$lib/server/api";

export const actions: Actions = {
  default: async ({ request, cookies, locals }) => {
    const form = await request.formData();
    const key = String(form.get("api_key") ?? "").trim();
    if (!key.startsWith("wh_")) {
      return fail(400, { message: "Enter a valid wh_ API key." });
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
    cookies.set("wh_key", key, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 30,
    });
    throw redirect(303, "/dashboard");
  },
};
