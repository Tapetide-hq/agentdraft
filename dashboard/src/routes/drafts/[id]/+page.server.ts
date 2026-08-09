import type { PageServerLoad, Actions } from "./$types";
import { apiJson, apiFetch } from "$lib/server/api";
import { requireKey } from "$lib/server/guard";
import { error, redirect } from "@sveltejs/kit";

interface Version {
  id: string;
  version_number: number;
  content_hash: string;
  file_size: number;
  title: string | null;
  original_filename: string | null;
  cli_version: string | null;
  git_branch: string | null;
  git_commit_sha: string | null;
  git_dirty: number | null;
  source_format: string | null;
  created_at: string;
}
interface Draft {
  id: string;
  title: string;
  description: string | null;
  published_version: number | null;
  public_url: string;
  project_id: string | null;
  // 0/1 from D1, not a boolean.
  is_public: number;
  visibility_changed_at: string | null;
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const ctx = requireKey(locals);
  const res = await apiJson<{ draft: Draft; versions: Version[] }>(
    ctx,
    `/api/drafts/${params.id}`,
  );
  return {
    draft: res.draft,
    versions: res.versions,
    contentBase: locals.contentBase,
  };
};

export const actions: Actions = {
  delete: async ({ locals, params }) => {
    const ctx = requireKey(locals);
    const res = await apiFetch(ctx, `/api/drafts/${params.id}`, { method: "DELETE" });
    if (!res.ok) throw error(res.status, "Failed to delete draft.");
    throw redirect(303, "/dashboard");
  },

  // Flip THIS draft between public and private.
  //
  // The desired state is sent explicitly rather than toggled server-side from the
  // current value: a toggle computed from stale page data flips the wrong way when two
  // tabs are open, or when the value changed via the CLI since this page loaded.
  visibility: async ({ locals, params, request }) => {
    const ctx = requireKey(locals);
    const form = await request.formData();
    const wantPublic = form.get("public") === "true";
    const res = await apiFetch(ctx, `/api/drafts/${params.id}/visibility`, {
      method: "PATCH",
      body: JSON.stringify({ public: wantPublic }),
    });
    if (!res.ok) throw error(res.status, "Failed to change visibility.");
    // No redirect: SvelteKit re-runs `load` after an action, so the page re-reads the
    // authoritative value from the API instead of trusting what we just sent.
    return { visibilityChanged: true, nowPublic: wantPublic };
  },
};
