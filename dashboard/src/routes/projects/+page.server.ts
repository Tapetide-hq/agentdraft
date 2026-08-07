import type { PageServerLoad, Actions } from "./$types";
import { apiJson, apiFetch } from "$lib/server/api";
import { requireKey } from "$lib/server/guard";
import { fail } from "@sveltejs/kit";

interface Project {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
}

export const load: PageServerLoad = async ({ locals }) => {
  const ctx = requireKey(locals);
  const res = await apiJson<{ projects: Project[] }>(ctx, "/api/projects");
  return { projects: res.projects };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const ctx = requireKey(locals);
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    if (!name) return fail(400, { message: "Name is required." });
    const res = await apiFetch(ctx, "/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name,
        description: String(form.get("description") ?? "") || undefined,
      }),
    });
    if (!res.ok) return fail(res.status, { message: "Failed to create project." });
    return { created: true };
  },
};
