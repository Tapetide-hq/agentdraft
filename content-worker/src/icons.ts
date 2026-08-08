// Brand icons served from the CONTENT origin. GENERATED — do not hand-edit.
// Regenerate with: scripts/gen-icons.sh
//
// WHY THIS EXISTS. Published documents are served BYTE-FOR-BYTE (that guarantee is the
// product), so we cannot inject a <link rel="icon"> into a user's HTML. But a browser
// requests /favicon.ico from the ORIGIN ROOT on its own when a document declares no
// icon, which every uploaded document does. Serving it here gives every published draft
// a real tab icon without altering a single byte of user content.
//
// The ICO is embedded as base64 rather than fetched from R2 or an assets binding: this
// worker's bindings are deliberately limited to read-only D1 + R2 for user content, and
// widening the untrusted-content origin's surface to serve 5 KB is a bad trade. Embedded
// also means no I/O and no failure mode on the hot path.

// 16x16 + 32x32 multi-resolution ICO, derived from dashboard/static/favicon.svg.
const FAVICON_ICO_B64 =
  "AAABAAIAEBAAAAEAIABoBAAAJgAAACAgAAABACAAqBAAAI4EAAAoAAAAEAAAACAAAAABACAAAAAAAAAEAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAoKCksKCgrJCgoK+QoKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK+QoKCskKCgpKAAAAAAoK" +
  "CksKCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCkoKCgrLCgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgrJCgoK+QoKCv8KCgr/IPXW/yD1" +
  "1v8g9db/IPXW/yD11v8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK+AoKCv8KCgr/CgoK/yD11v8g9db/IPXW/yD1" +
  "1v8g9db/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK////////////////////////////////////////////////////" +
  "//8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv//////////////////////////////////////////////////////CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv//////////////////////////////////////////////////////CgoK/woKCv8KCgr/CgoK+QoKCv8KCgr/////////" +
  "/////////////////////////////////////////////woKCv8KCgr/CgoK+AoKCssKCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCskKCgpMCgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgpQAAAAAAoKCkwKCgrKCgoK+QoKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK+QoKCsoKCgpLAAAAAIABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAIABAAAoAAAAIAAAAEAAAAABACAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMFQoK" +
  "CoIKCgrNCgoK8woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCvMKCgrNCgoKgQ0NDRQAAAAAAAAAAAAAAAAAAAAAAAAAAAkJCVQKCgrxCgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK8AkJCVIAAAAAAAAAAAAAAAAJCQlUCgoK/goKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/gkJ" +
  "CVIAAAAADAwMFgkJCfIKCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK8A0NDRQKCgqDCgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoKgQoKCs8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgrOCQkJ8goKCv8KCgr/CgoK/woKCv8KCgr/IPXW/yD11v8g9db/IPXW/yD1" +
  "1v8g9db/IPXW/yD11v8g9db/IPXW/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCvEKCgr/CgoK/woKCv8KCgr/CgoK/woKCv8g9db/IPXW/yD11v8g9db/IPXW/yD11v8g9db/IPXW/yD1" +
  "1v8g9db/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/yD11v8g9db/IPXW/yD11v8g9db/IPXW/yD11v8g9db/IPXW/yD11v8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/IPXW/yD11v8g9db/IPXW/yD11v8g9db/IPXW/yD11v8g9db/IPXW/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK////" +
  "////////////////////////////////////////////////////////////////////////////////////////////////" +
  "////////CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/////////////////////////" +
  "//////////////////////////////////////////////////////////////////////////////////8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv//////////////////////////////////////////////" +
  "/////////////////////////////////////////////////////////////woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK////////////////////////////////////////////////////////////////////" +
  "////////////////////////////////////////CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv//////////////////////////////////////////////////////////////////////////////" +
  "/////////////////////////////woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK////" +
  "////////////////////////////////////////////////////////////////////////////////////////////////" +
  "////////CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/////////////////////////" +
  "//////////////////////////////////////////////////////////////////////////////////8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgrzCgoK/woKCv8KCgr/CgoK/woKCv//////////////////////////////////////////////" +
  "/////////////////////////////////////////////////////////////woKCv8KCgr/CgoK/woKCv8KCgr/CQkJ8goK" +
  "CtAKCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgrOCgoKhAoKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCoIMDAwWCQkJ8goKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgrxDAwMFQAAAAAJCQlVCgoK/goKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/gkJ" +
  "CVQAAAAAAAAAAAAAAAAJCQlVCQkJ8goKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/wkJCfIJCQlUAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAMDAwWCgoKhAoKCs8KCgr0CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woKCv8KCgr/CgoK/woK" +
  "Cv8KCgr/CgoK/woKCv8KCgr/CgoK9AoKCs4KCgqDDAwMFgAAAAAAAAAAAAAAAOAAAAfAAAADgAAAAQAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAgAAAAcAAAAPgAAAH";;

// Scalable variant for browsers that prefer an SVG icon.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="agentdraft">
  <!-- Geometry is deliberately pixel-aligned for a 16px favicon: the viewBox is 32
       units, so every 2 units = 1 device pixel at 16px. Bar heights (4), gaps (4), and
       x-offsets (6) are all even, which keeps edges crisp instead of antialiased to mush
       at the size browsers actually render in a tab. -->
  <rect width="32" height="32" rx="7" fill="#0a0a0a"/>
  <g fill="#ffffff">
    <rect x="6" y="6" width="20" height="4"/>
    <rect x="6" y="14" width="20" height="4"/>
  </g>
  <!-- Half-width accent bar: the shortness is intentional (a draft is an unfinished
       document), so it must read as deliberate rather than as a clipped full bar. -->
  <rect x="6" y="22" width="10" height="4" fill="#d6f520"/>
</svg>`;

let icoBytes: Uint8Array | null = null;

function decodeIco(): Uint8Array {
  if (icoBytes) return icoBytes;
  const bin = atob(FAVICON_ICO_B64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  icoBytes = out;
  return out;
}

// Icons are static, public, and identical for every visitor, so they take a long
// immutable cache. They must NOT inherit securityHeaders() — that sets
// Content-Type: text/html, which would break the image and trip nosniff.
const ICON_CACHE = "public, max-age=31536000, immutable";

/**
 * Returns an icon response for the well-known icon paths, or null if `pathname` is not
 * an icon route (so the caller falls through to normal document routing).
 */
export function iconResponse(pathname: string, method: string): Response | null {
  if (pathname === "/favicon.ico") {
    const bytes = decodeIco();
    return new Response(method === "HEAD" ? null : bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/x-icon",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": ICON_CACHE,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  // Only /favicon.svg is served here. NOT /icon.svg: that path serves the inset
  // maskable app icon on the dashboard origin, and answering it with the tab favicon
  // would mean one path returns two different assets depending on origin.
  if (pathname === "/favicon.svg") {
    return new Response(method === "HEAD" ? null : FAVICON_SVG, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": ICON_CACHE,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  return null;
}
