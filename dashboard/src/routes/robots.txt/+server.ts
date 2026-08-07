import type { RequestHandler } from "./$types";

// robots.txt for the dashboard/marketing origin.
//
// Only the landing page is a search target. Authenticated surfaces are disallowed here
// AND send noindex, because Disallow alone does not prevent indexing of a URL that is
// linked from elsewhere — the two controls do different jobs and both are needed.
//
// Published DOCUMENTS live on a different origin (the content worker) which serves its
// own noindex on every response; they are never in this sitemap.
const BODY = `User-agent: *
Allow: /$
Allow: /login
Disallow: /dashboard
Disallow: /projects
Disallow: /settings
Disallow: /drafts
Disallow: /logout

Sitemap: https://app.agentdraft.tapetide.com/sitemap.xml
`;

export const GET: RequestHandler = () =>
  new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
