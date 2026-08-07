import type { PageServerLoad } from "./$types";
import { apiJson } from "$lib/server/api";
import { requireKey } from "$lib/server/guard";

interface Draft {
  id: string;
  title: string;
  published_version: number | null;
  updated_at: string;
  public_url: string;
  project_id: string | null;
}

export const load: PageServerLoad = async ({ locals }) => {
  const ctx = requireKey(locals);
  const [me, drafts] = await Promise.all([
    apiJson<{ account: { name: string } }>(ctx, "/api/me"),
    apiJson<{ drafts: Draft[] }>(ctx, "/api/drafts?limit=200"),
  ]);
  return { accountName: me.account.name, drafts: drafts.drafts, contentBase: locals.contentBase };
};
