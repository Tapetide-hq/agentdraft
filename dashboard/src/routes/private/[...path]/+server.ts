import { redirect, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { apiFetch } from "$lib/server/api";

// GET /private/d/:id            — a PRIVATE draft, streamed to its owner
// GET /private/d/:id/v/:n       — a specific version
// GET /private/d/:id/raw        — the exact uploaded source
//
// WHY THIS ROUTE EXISTS.
//
// The content origin is cookie-free by design: it serves attacker-controlled HTML, so a
// session must never be readable there. It therefore cannot authorize a viewer, and a
// private draft 302s here instead. This handler runs on the DASHBOARD origin, where the
// session lives, so it can prove who the viewer is and stream the bytes itself.
//
// The user-visible contract is "the shared link just opens when I'm signed in": the URL
// the owner pasted is unchanged, and this hop is invisible in normal browsing. A
// signed-out viewer is sent to sign in and returns to this exact document afterwards.
//
// It deliberately returns the RAW DOCUMENT, not a dashboard page with chrome around it —
// a draft link should feel like a bare document wherever it is opened.

const DRAFT_PATH = /^d\/([a-z0-9]{6,32})(?:\/v\/(\d+))?(\/raw)?\/?$/;

export const GET: RequestHandler = async ({ params, locals, url }) => {
  const path = params.path ?? "";
  const m = DRAFT_PATH.exec(path);
  // Not a draft-shaped path. 404 rather than forwarding an arbitrary string to the API.
  if (!m) throw error(404, "Not found");

  const [, draftId, versionStr, rawSuffix] = m;

  // Not signed in -> sign in, then come back HERE. `next` is validated on the way back
  // (see /login) so it can only ever be an internal path, never an open redirect.
  if (!locals.sessionId && !locals.apiKey) {
    throw redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
  }

  const qs = new URLSearchParams();
  if (versionStr) qs.set("v", versionStr);
  if (rawSuffix) qs.set("raw", "1");
  const suffix = qs.toString() ? `?${qs}` : "";

  const res = await apiFetch(
    {
      apiBase: locals.apiBase,
      apiKey: locals.apiKey,
      service: locals.apiService,
      sessionId: locals.sessionId,
    },
    `/api/drafts/${draftId}/content${suffix}`,
  );

  if (res.status === 404) {
    // The API answers 404 for "no such draft" AND for "not yours" — deliberately
    // indistinguishable, so this endpoint cannot be used to enumerate other accounts'
    // drafts. Keep that collapse here; do not helpfully differentiate.
    throw error(404, "Not found");
  }
  if (res.status === 401 || res.status === 403) {
    // Session expired or belongs to a different account. Re-authenticate and return.
    throw redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
  }
  if (res.status === 451) throw error(451, "This document has been disabled.");
  if (!res.ok) throw error(502, "Could not load this document.");

  // Stream the body straight through — never buffer a document that may be up to 2 MiB.
  //
  // The API already set the hardening headers (CSP with sandbox, nosniff, noindex,
  // no-store). They are copied rather than regenerated so there is ONE source of truth:
  // if the API tightens its policy, this path inherits it automatically instead of
  // drifting into a weaker copy.
  const headers = new Headers();
  for (const h of [
    "content-type",
    "content-security-policy",
    "x-content-type-options",
    "x-robots-tag",
    "referrer-policy",
    "cache-control",
    "x-agentdraft-draft-id",
    "x-agentdraft-version",
    "x-agentdraft-visibility",
  ]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Belt and braces: if the API ever omitted these, a private document would be served
  // from the dashboard origin with no policy at all.
  if (!headers.has("cache-control")) headers.set("cache-control", "private, no-store");
  if (!headers.has("x-robots-tag")) headers.set("x-robots-tag", "noindex, nofollow");
  if (!headers.has("content-security-policy")) {
    headers.set(
      "content-security-policy",
      "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:; media-src https:; script-src 'none'; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'; sandbox allow-popups",
    );
  }

  return new Response(res.body, { status: 200, headers });
};
