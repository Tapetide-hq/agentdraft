# agentdraft error codes

The server returns one envelope for every error: `{ "ok": false, "error": { "code", "message" } }`.
The CLI prints `error: <message> (<code>)` on stderr and exits 1. Document-validation
failures may add a bulleted list of individual `<code>: <message>` findings.

## Document validation (`agentdraft upload`)

Applies to HTML uploads and to the HTML produced by rendering a Markdown upload. Fix the
document and re-upload to the same path.

| Code | Trigger | Fix |
|---|---|---|
| `E_SCRIPT` | `<script>` element | Remove all JavaScript. No charting libraries. |
| `E_EVENT_HANDLER` | Any `on*=` attribute (`onclick`, `onload`, …) | Remove the attribute. |
| `E_LINK` | `<link>` element | Inline the CSS in a `<style>` block. No external fonts. |
| `E_FORM` | `<form>`, `<input>`, `<textarea>`, `<select>`, `<button>` | Use static text or a table. |
| `E_FRAME` | `<iframe>`, `<frame>`, `<frameset>`, `<portal>` | Link to the resource with `<a href>` instead. |
| `E_PLUGIN` | `<object>`, `<embed>`, `<applet>` | Use `<img>` or a link. |
| `E_META_REFRESH` | `<meta http-equiv="refresh">` | Remove it. |
| `E_BASE` | `<base>` element | Use absolute `https:` URLs. |
| `E_SRCDOC` | `srcdoc` attribute | Remove it. |
| `E_DANGEROUS_URL` | `javascript:`, `vbscript:`, `data:text/html`, `file:` in a URL attribute | Use `https:`, `mailto:`, `#fragment`, or `data:image/*`. |
| `E_DANGEROUS_CSS` | CSS `expression()`, `behavior:`, `-moz-binding`, `@import`, `url(javascript:…)` | Plain CSS only. |
| `E_ATTR_UNSAFE` / `E_ATTRS` | Other disallowed attribute patterns | Remove the flagged attribute. |
| `E_MXSS` | Namespace / parse-differential tricks (`<svg><style>`, `<math>` smuggling, `<template>`, `<noscript>`) | Simplify the markup; keep SVG inline and plain. |
| `E_MALFORMED` | Not parseable as HTML5 | Fix the markup. |
| `E_EMPTY` | Zero-byte document | Write content first. |
| `E_TOO_LARGE` | HTML over 2 MiB; Markdown source over 1 MiB | Split the document or drop embedded images. |
| `E_ENCODING` | Not valid UTF-8, or a declared non-UTF-8 charset | Save as UTF-8. |
| `E_WARN_BYTES` | Warning only (stderr): document is large but under the limit | Nothing required. |

## File upload (`agentdraft file`)

| Code | Trigger | Fix |
|---|---|---|
| `E_TOO_LARGE` | File over 100 MB | Compress or split. |
| `E_BAD_FILENAME` | Filename header missing or contains path separators | Pass a plain file; the CLI sends the basename. |
| `E_BYTES` / `E_NO_CONTENT` | Empty body | The file must not be empty. |

## Auth and account

| Code | Trigger | Fix |
|---|---|---|
| `E_UNAUTHENTICATED` | No key stored, or the key was revoked | `agentdraft auth set <key>`. Ask the human for a key; do not guess. |
| `E_INVALID_KEY` / `E_BAD_KEY` | Key malformed or unknown | Same as above. |
| `E_FORBIDDEN` | Key lacks the required scope (`upload` for publishing, `read` for listing) | Create a key with the right scope in the dashboard. |
| `E_RATE_LIMITED` | Too many requests in the current window | Wait for the window to pass. Do not retry in a tight loop. |
| `E_EMAIL_UNVERIFIED` / `E_GOOGLE_SIGNIN_REQUIRED` | Account not fully set up on a hosted instance | The human must finish sign-in in the dashboard. |

## Targets

| Code | Trigger | Fix |
|---|---|---|
| `E_DRAFT_NOT_FOUND` | `--draft <id>` or `visibility <id>` for a draft that does not exist or is not yours | Check `agentdraft list`. The server deliberately does not distinguish "missing" from "someone else's". |
| `E_PROJECT_NOT_FOUND` | `--project proj_…` id does not exist | Use a project name (auto-created) or an id from `agentdraft projects`. |
| `E_VERSION_NOT_FOUND` | `fetch --version <n>` beyond the latest | Check `Version:` from the last upload. |
| `E_FILE_NOT_FOUND` / `E_DISABLED` | File id unknown or taken down | Re-upload. |
| `E_CONTENT_UNAVAILABLE` | Stored object missing | Re-upload. |

## Request shape

| Code | Trigger |
|---|---|
| `E_BAD_JSON` / `E_BAD_FIELD` / `E_BAD_REQUEST` / `E_NO_FIELDS` / `E_URL` / `E_BAD_VERSION` | Malformed request — should not happen through the CLI; upgrade the CLI if you see these. |
| `E_INTERNAL` / `E_STORAGE` | Server-side fault. Retry once with `--idempotency-key`; then report to the human. |
