import type { Handle } from "@sveltejs/kit";
import { env as dynEnv } from "$env/dynamic/private";
import { dev } from "$app/environment";

// BFF identity: the dashboard holds the API key in an httpOnly cookie on its OWN
// origin. It is read here server-side and attached to locals; client JS never sees it.
export const handle: Handle = async ({ event, resolve }) => {
  const env = event.platform?.env;
  // Under `vite dev` the Cloudflare adapter emulates platform.env from wrangler.jsonc, so
  // the vars there (production URLs, a miniflare-emulated service binding) win by default.
  // An explicit API_BASE_URL / CONTENT_BASE_URL in the process environment overrides them
  // in dev only, so the dashboard can be pointed at a local API. The emulated binding
  // rejects the Request object apiFetch builds, so the override also bypasses it and talks
  // to the API over plain fetch. `dev` is compile-time false in the production bundle.
  //
  // `||` rather than `??` so an EMPTY string counts as unset: otherwise API_BASE_URL=""
  // would yield a relative apiBase while the binding check below still saw it as falsy,
  // and the two would disagree. A content-only override still bypasses the binding, since
  // the emulated binding cannot serve any request apiFetch makes.
  const localApi = dev ? dynEnv.API_BASE_URL || undefined : undefined;
  const localContent = dev ? dynEnv.CONTENT_BASE_URL || undefined : undefined;
  event.locals.apiBase =
    localApi ?? env?.API_BASE_URL ?? "https://agentdraft-api.tapetide.workers.dev";
  event.locals.contentBase =
    localContent ?? env?.CONTENT_BASE_URL ?? "https://agentdraft-content.tapetide.workers.dev";
  event.locals.apiKey = event.cookies.get("ad_key") ?? null;
  event.locals.sessionId = event.cookies.get("ad_session") ?? null;
  event.locals.apiService = localApi || localContent ? null : (env?.API ?? null);
  return resolve(event);
};
