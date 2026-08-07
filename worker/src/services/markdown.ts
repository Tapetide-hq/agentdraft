// Markdown -> HTML rendering for agentdraft.
//
// Agents write plans in Markdown far more often than in HTML, but a human reviewer
// wants to open a URL and READ it, not stare at raw asterisks. So a .md upload is
// rendered to a self-contained HTML document for /d/:id while the exact uploaded bytes
// stay byte-for-byte retrievable at /d/:id/raw.
//
// SECURITY: rendering does NOT bypass validation. Markdown permits raw HTML
// passthrough, so `<script>alert(1)</script>` inside a .md file becomes a real script
// tag in the rendered output. The rendered HTML is therefore fed through the SAME
// authoritative validator as a direct HTML upload, and a document whose rendered form
// violates the policy is rejected. The renderer is not a sanitiser and must never be
// treated as one — it is the validator that decides.

import { marked } from "marked";

export const MAX_MD_BYTES = 1024 * 1024; // 1 MiB of source Markdown

// GFM task lists (`- [x] done`) render by default as
// `<input checked disabled type="checkbox">`. `<input>` is a FORM CONTROL, which the
// HTML policy blocks outright — so an ordinary agent checklist would be rejected by our
// own validator. That rejection is correct: the policy must not special-case an
// element just because we happened to emit it. The fix belongs in the renderer, which
// substitutes inert Unicode ballot glyphs carrying no interactive semantics.
marked.use({
  renderer: {
    checkbox({ checked }: { checked: boolean }): string {
      return checked
        ? '<span class="task-box task-box--done" aria-hidden="true">\u2611</span>'
        : '<span class="task-box" aria-hidden="true">\u2610</span>';
    },
  },
});

// Self-contained, dependency-free styling. No external fonts/CSS: the CSP on the
// content origin forbids remote script/connect, and an offline-readable document is
// the point. Uses a light canvas because uploaded documents are read like paper.
const DOC_CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;padding:3rem 1.5rem;background:#fff;color:#1a1a1a;
  font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-text-size-adjust:100%}
main{max-width:44rem;margin:0 auto}
h1,h2,h3,h4,h5,h6{line-height:1.25;margin:2rem 0 .75rem;font-weight:650;letter-spacing:-.01em}
h1{font-size:2.1rem;margin-top:0}
h2{font-size:1.55rem;padding-bottom:.3rem;border-bottom:1px solid #e5e7eb}
h3{font-size:1.25rem}
h4{font-size:1.05rem}
p{margin:0 0 1.1rem}
a{color:#0b62d6;text-decoration:underline;text-underline-offset:2px}
ul,ol{margin:0 0 1.1rem;padding-left:1.6rem}
li{margin:.3rem 0}
li>p{margin:.3rem 0}
code{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:4px;padding:.1em .35em;
  font:0.88em/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
pre{background:#f8f9fb;border:1px solid #e5e7eb;border-radius:6px;padding:1rem;
  overflow-x:auto;margin:0 0 1.2rem}
pre code{background:none;border:0;padding:0;font-size:.86rem;line-height:1.6}
blockquote{margin:0 0 1.2rem;padding:.2rem 0 .2rem 1.1rem;border-left:3px solid #d1d5db;color:#4b5563}
table{width:100%;border-collapse:collapse;margin:0 0 1.3rem;font-size:.94rem;display:block;overflow-x:auto}
th,td{border:1px solid #e5e7eb;padding:.55rem .7rem;text-align:left;vertical-align:top}
th{background:#f9fafb;font-weight:650}
img{max-width:100%;height:auto}
hr{border:0;border-top:1px solid #e5e7eb;margin:2rem 0}
/* Task lists: suppress the list bullet so the ballot glyph is the only marker.
   Without this an item shows BOTH a disc and a checkbox (confirmed in the DOM:
   computed list-style-type was "disc"). :has() is baseline in all current
   browsers; the margin pull-back re-aligns the row with surrounding text. */
li:has(> .task-box){list-style:none;margin-left:-1.25em}
.task-box{display:inline-block;width:1.15em;margin-right:.4em;color:#6b7280;
  font-family:ui-monospace,monospace;font-size:1.15em;line-height:1;
  /* ballot glyphs come from a fallback font and sit high at cap-height; nudge them
     down so they read as optically centred on the lowercase label text */
  vertical-align:-.08em}
.task-box--done{color:#059669}
@media (max-width:640px){body{padding:1.75rem 1.1rem}h1{font-size:1.75rem}}
`.trim();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Extract a title: the first ATX/setext H1, else the first non-empty line.
export function extractMarkdownTitle(md: string): string | null {
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const atx = line.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/);
    if (atx) return atx[1].trim() || null;
    // setext: text followed by === underline
    if (line.trim() && /^\s{0,3}=+\s*$/.test(lines[i + 1] ?? "")) {
      return line.trim();
    }
  }
  for (const line of lines) {
    const t = line.trim();
    if (t) {
      // strip common leading markup so a bullet/quote doesn't become the title
      return t.replace(/^[>#*\-+\s]+/, "").trim() || null;
    }
  }
  return null;
}

export interface RenderedMarkdown {
  html: string;
  title: string | null;
}

// Render Markdown to a complete, self-contained HTML document.
// `marked` is configured with GFM (tables, task lists, strikethrough, autolinks).
// It is synchronous here: async:false keeps the return type a string, since the
// Workers request path benefits from avoiding an extra await and we use no async
// extensions.
export function renderMarkdown(md: string, titleOverride?: string | null): RenderedMarkdown {
  const body = marked.parse(md, { gfm: true, breaks: false, async: false }) as string;
  const title = titleOverride ?? extractMarkdownTitle(md) ?? "Untitled";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${DOC_CSS}
</style>
</head>
<body>
<main>
${body}</main>
</body>
</html>
`;
  return { html, title };
}

// Decide whether an upload should be treated as Markdown.
// Explicit `format` wins; otherwise infer from the filename extension.
export function isMarkdownUpload(format: unknown, filename: unknown): boolean {
  if (typeof format === "string") {
    const f = format.toLowerCase();
    if (f === "md" || f === "markdown") return true;
    if (f === "html") return false;
  }
  if (typeof filename === "string") {
    return /\.(md|markdown|mdown|mkd)$/i.test(filename.trim());
  }
  return false;
}
