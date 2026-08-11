import type { PageServerLoad, Actions } from "./$types";
import { apiJson, apiFetch } from "$lib/server/api";
import { requireKey } from "$lib/server/guard";
import { fail } from "@sveltejs/kit";

interface FileItem {
  id: string;
  filename: string;
  content_type: string;
  file_size: number;
  disabled_at: string | null;
  created_at: string;
  public_url: string;
}

export const load: PageServerLoad = async ({ locals }) => {
  const ctx = requireKey(locals);
  const [me, files] = await Promise.all([
    apiJson<{ account: { name: string } }>(ctx, "/api/me"),
    apiJson<{ files: FileItem[] }>(ctx, "/api/files?limit=200"),
  ]);
  return { accountName: me.account.name, files: files.files };
};

export const actions: Actions = {
  disable: async ({ request, locals }) => {
    const ctx = requireKey(locals);
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    if (!id) return fail(400, { message: "Missing file id." });
    const res = await apiFetch(ctx, `/api/files/${id}/disable`, { method: "POST" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return fail(res.status, { message: body.error?.message ?? "Failed to disable the file." });
    }
    return { disabled: true };
  },
};
