import type { PageServerLoad, Actions } from "./$types";
import { apiJson, apiFetch } from "$lib/server/api";
import { requireKey } from "$lib/server/guard";
import { fail } from "@sveltejs/kit";

interface MeResponse {
  account: { id: string; name: string; email: string | null; default_draft_public: boolean };
}

interface DraftRow {
  id: string;
  title: string;
  is_public: number;
}

export const load: PageServerLoad = async ({ locals }) => {
  const ctx = requireKey(locals);
  const me = await apiJson<MeResponse>(ctx, "/api/me");

  // Count how many existing drafts are public vs private, so the bulk action can state a
  // real number instead of an abstract warning. "Make 47 drafts private" is a decision a
  // user can actually make; "make all drafts private" is a gamble.
  let publicCount = 0;
  let privateCount = 0;
  try {
    const list = await apiJson<{ drafts: DraftRow[] }>(ctx, "/api/drafts?limit=500");
    for (const d of list.drafts) {
      if (d.is_public === 0) privateCount++;
      else publicCount++;
    }
  } catch {
    // Counts are advisory. A failure here must not break the settings page — the toggle
    // and the bulk action still work without them.
  }

  return {
    defaultPublic: me.account.default_draft_public,
    publicCount,
    privateCount,
  };
};

export const actions: Actions = {
  // Change the default applied to NEWLY created drafts. Existing drafts untouched.
  //
  // NOT named `default`: SvelteKit reserves that for the unnamed default action and
  // rejects an explicit `?/default` with a 500. Naming it that broke the button in the
  // UI as well as direct POSTs — caught by exercising the form action rather than only
  // rendering the page, which returned a healthy 200 throughout.
  setdefault: async ({ request, locals }) => {
    const ctx = requireKey(locals);
    const form = await request.formData();
    const wantPublic = form.get("public") === "true";
    const res = await apiFetch(ctx, "/api/me/settings", {
      method: "PATCH",
      body: JSON.stringify({ default_draft_public: wantPublic }),
    });
    if (!res.ok) return fail(res.status, { message: "Could not change the default." });
    return { defaultChanged: true, nowPublic: wantPublic };
  },

  // Apply a visibility to EVERY existing draft.
  //
  // Deliberately separate from the default toggle: changing a preference must never
  // silently rewrite links already shared with reviewers. The user confirms this
  // explicitly, and the response reports how many rows actually changed so the UI can
  // say what really happened rather than assuming success.
  bulk: async ({ request, locals }) => {
    const ctx = requireKey(locals);
    const form = await request.formData();
    const wantPublic = form.get("public") === "true";
    const res = await apiFetch(ctx, "/api/drafts/visibility/bulk", {
      method: "POST",
      body: JSON.stringify({ public: wantPublic }),
    });
    if (!res.ok) return fail(res.status, { message: "Bulk change failed." });
    const data = (await res.json()) as { changed?: number };
    return { bulkChanged: data.changed ?? 0, nowPublic: wantPublic };
  },
};
