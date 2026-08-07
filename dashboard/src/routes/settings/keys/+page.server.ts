import type { PageServerLoad, Actions } from "./$types";
import { apiJson, apiFetch } from "$lib/server/api";
import { requireKey } from "$lib/server/guard";
import { fail } from "@sveltejs/kit";

interface KeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export const load: PageServerLoad = async ({ locals }) => {
  const ctx = requireKey(locals);
  try {
    const res = await apiJson<{ keys: KeyRow[] }>(ctx, "/api/api-keys");
    return { keys: res.keys, canManage: true };
  } catch {
    // The signed-in key lacks the "manage" scope. Surface it cleanly rather than 500.
    return { keys: [] as KeyRow[], canManage: false };
  }
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const ctx = requireKey(locals);
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim() || "cli";
    const scopes = form.getAll("scopes").map(String);
    const res = await apiFetch(ctx, "/api/api-keys", {
      method: "POST",
      body: JSON.stringify({ name, scopes: scopes.length ? scopes : ["upload", "read"] }),
    });
    const data = (await res.json()) as { api_key?: string; error?: { message?: string } };
    if (!res.ok) return fail(res.status, { message: data.error?.message ?? "Failed." });
    // Return the plaintext key ONCE so the UI can show it.
    return { newKey: data.api_key, name };
  },
  revoke: async ({ request, locals }) => {
    const ctx = requireKey(locals);
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const res = await apiFetch(ctx, `/api/api-keys/${id}`, { method: "DELETE" });
    if (!res.ok) return fail(res.status, { message: "Failed to revoke." });
    return { revoked: id };
  },
};
