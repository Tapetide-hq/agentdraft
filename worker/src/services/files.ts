// Shared policy for the arbitrary-file lane. Imported by the API worker (upload) and
// mirrored by convention in the content worker (serve). The two workers do not share a
// module at runtime, so the content worker re-declares INLINE_ALLOWLIST with a comment
// pointing here — keep them identical.

// Cloudflare Free plan caps the REQUEST BODY at 100 MB (verified against
// developers.cloudflare.com/workers/platform/limits). This is the real ceiling; Worker
// memory (128 MB) is not, because we stream to R2 and never buffer the body.
export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MiB

// The ONLY MIME types served inline (Content-Disposition: inline). Everything else is
// forced to download (attachment). This is the core safety gate: a file whose declared
// type is text/html or image/svg+xml is NOT here, so it can never be rendered as an
// executable document on this origin — which is the same origin that serves drafts.
//
// Paired ALWAYS with X-Content-Type-Options: nosniff, so a file that lies about its type
// (claims image/png but is really HTML) is still treated as the declared type and cannot
// be reinterpreted as markup by the browser.
export const INLINE_ALLOWLIST = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "text/plain",
  "application/pdf",
]);

export function isInlineType(contentType: string): boolean {
  // Strip any charset/parameter before matching: "text/plain; charset=utf-8" -> "text/plain"
  const base = contentType.split(";")[0].trim().toLowerCase();
  return INLINE_ALLOWLIST.has(base);
}

// Extension -> MIME fallback for when a client sends no/blank Content-Type. Conservative:
// anything unknown becomes application/octet-stream, which is NOT on the inline allowlist
// and therefore downloads. We never guess an inline type from an extension we don't know.
const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  pdf: "application/pdf",
  txt: "text/plain",
  log: "text/plain",
  json: "application/json",
  csv: "text/csv",
  md: "text/markdown",
  html: "text/html",
  htm: "text/html",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
};

export function mimeFromFilename(filename: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

// Resolve the MIME we STORE and SERVE. A client-provided type wins only when non-blank;
// otherwise fall back to the extension. Note: trusting the client type is SAFE because the
// inline decision is gated by INLINE_ALLOWLIST + nosniff, not by belief in the client.
export function resolveContentType(clientType: string | null, filename: string): string {
  const c = (clientType ?? "").split(";")[0].trim().toLowerCase();
  if (c && c !== "application/octet-stream") return c;
  return mimeFromFilename(filename);
}

// R2 object key for a file. Namespaced under files/ so it never collides with drafts/.
export function fileObjectKey(id: string): string {
  return `files/${id}`;
}

// Sanitize a filename for a Content-Disposition header. Returns both an ASCII-safe
// `filename=` fallback and an RFC 5987 `filename*=` value for full-fidelity names.
export function contentDisposition(disposition: "inline" | "attachment", filename: string): string {
  // Strip quotes, backslashes, and control chars from the quoted fallback.
  const ascii = filename.replace(/[\x00-\x1f"\\]/g, "_").replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
