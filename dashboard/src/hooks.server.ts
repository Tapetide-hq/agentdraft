import type { Handle } from "@sveltejs/kit";

// BFF identity: the dashboard holds the API key in an httpOnly cookie on its OWN
// origin. It is read here server-side and attached to locals; client JS never sees it.
export const handle: Handle = async ({ event, resolve }) => {
  const env = event.platform?.env;
  event.locals.apiBase =
    env?.API_BASE_URL ?? "https://agentdraft-api.tapetide.workers.dev";
  event.locals.contentBase =
    env?.CONTENT_BASE_URL ?? "https://agentdraft-content.tapetide.workers.dev";
  event.locals.apiKey = event.cookies.get("ad_key") ?? null;
  event.locals.sessionId = event.cookies.get("ad_session") ?? null;
  event.locals.apiService = env?.API ?? null;
  return resolve(event);
};
