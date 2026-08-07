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
};
