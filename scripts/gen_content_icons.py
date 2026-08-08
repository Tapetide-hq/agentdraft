#!/usr/bin/env python3
"""Generate content-worker/src/icons.ts from an .ico and an .svg.

Called by scripts/gen-icons.sh. Reads the ICO as BINARY and base64-encodes it here, so
the embedded payload is always byte-exact — an earlier hand-rolled attempt corrupted the
base64 by passing it through a line-numbered text read, producing a module that compiled
fine and served a broken image. The generator asserts round-trip equality to make that
class of failure impossible to commit.
"""
import base64
import pathlib
import sys

TEMPLATE = '''// Brand icons served from the CONTENT origin. GENERATED — do not hand-edit.
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
{ico_literal};

// Scalable variant for browsers that prefer an SVG icon.
const FAVICON_SVG = {svg_literal};

let icoBytes: Uint8Array | null = null;

function decodeIco(): Uint8Array {{
  if (icoBytes) return icoBytes;
  const bin = atob(FAVICON_ICO_B64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  icoBytes = out;
  return out;
}}

// Icons are static, public, and identical for every visitor, so they take a long
// immutable cache. They must NOT inherit securityHeaders() — that sets
// Content-Type: text/html, which would break the image and trip nosniff.
const ICON_CACHE = "public, max-age=31536000, immutable";

/**
 * Returns an icon response for the well-known icon paths, or null if `pathname` is not
 * an icon route (so the caller falls through to normal document routing).
 */
export function iconResponse(pathname: string, method: string): Response | null {{
  if (pathname === "/favicon.ico") {{
    const bytes = decodeIco();
    return new Response(method === "HEAD" ? null : bytes, {{
      status: 200,
      headers: {{
        "Content-Type": "image/x-icon",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": ICON_CACHE,
        "X-Content-Type-Options": "nosniff",
      }},
    }});
  }}
  // Only /favicon.svg is served here. NOT /icon.svg: that path serves the inset
  // maskable app icon on the dashboard origin, and answering it with the tab favicon
  // would mean one path returns two different assets depending on origin.
  if (pathname === "/favicon.svg") {{
    return new Response(method === "HEAD" ? null : FAVICON_SVG, {{
      status: 200,
      headers: {{
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": ICON_CACHE,
        "X-Content-Type-Options": "nosniff",
      }},
    }});
  }}
  return null;
}}
'''


def chunk_literal(b64: str, width: int = 96) -> str:
    """Emit the base64 as concatenated string chunks so the file stays readable."""
    parts = [b64[i:i + width] for i in range(0, len(b64), width)]
    return "\n".join(f'  "{p}"' + (" +" if i < len(parts) - 1 else ";")
                     for i, p in enumerate(parts))


def main() -> int:
    ico_path, svg_path, out_path = (pathlib.Path(p) for p in sys.argv[1:4])

    raw = ico_path.read_bytes()
    if raw[:4] != b"\x00\x00\x01\x00":
        print(f"ERROR: {ico_path} is not an ICO (bad magic {raw[:4]!r})", file=sys.stderr)
        return 1
    b64 = base64.b64encode(raw).decode("ascii")

    # Round-trip assertion: the whole reason this generator exists.
    assert base64.b64decode(b64, validate=True) == raw, "base64 round-trip mismatch"

    svg = svg_path.read_text(encoding="utf-8").strip()
    if "`" in svg or "${" in svg:
        print("ERROR: SVG contains a backtick or ${ — unsafe in a TS template literal",
              file=sys.stderr)
        return 1

    out_path.write_text(
        TEMPLATE.format(ico_literal=chunk_literal(b64), svg_literal=f"`{svg}`"),
        encoding="utf-8",
    )
    print(f"  wrote {out_path} (ico {len(raw)} B -> {len(b64)} b64 chars, svg {len(svg)} B)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
