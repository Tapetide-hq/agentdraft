import { defineEnvVars } from "@sveltejs/kit/env";

// "" counts as unset, so API_BASE_URL="" cannot yield a relative apiBase.
const optional = (value: string | undefined) => value || undefined;

// Dev-only overrides read by hooks.server.ts. Without a schema Kit would require them.
export const variables = defineEnvVars({
  API_BASE_URL: {
    schema: optional,
    description: "Dev only: point the dashboard at a local API instead of the service binding.",
  },
  CONTENT_BASE_URL: {
    schema: optional,
    description: "Dev only: override the content origin.",
  },
});
