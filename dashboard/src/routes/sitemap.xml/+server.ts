import type { RequestHandler } from "./$types";

// Sitemap for the marketing origin only.
//
// It lists ONLY the public landing page. Authenticated pages are noindex, and published
// documents live on a separate origin that sends noindex on every response — putting
// user-generated documents in a sitemap would actively invite them into search results,
// which is precisely what the security model rejects.
const SITE = "https://app.agentdraft.tapetide.com";

const urls: Array<{ loc: string; priority: string; changefreq: string }> = [
  { loc: `${SITE}/`, priority: "1.0", changefreq: "weekly" },
];

export const GET: RequestHandler = () => {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join("\n")}
</urlset>
`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
