# AgentDraft HTML Policy

This is the normative specification of what HTML AgentDraft accepts. It is implemented
**twice** — once in TypeScript (`worker/src/services/html-validator.ts`) and once in Go
(`cli/internal/validate/html.go`) — and both implementations are tested against the
single shared corpus in `shared/html-policy-fixtures.json`.

Any change to the policy MUST change the fixture corpus. A drifted implementation is a
failing test in one of the two suites, not a runtime surprise.

## Threat model

Uploaded HTML is **fully attacker-controlled**. It is served byte-for-byte from a
dedicated origin (`agentdraft-content`) that never holds a session cookie, so a successful
bypass yields defacement of an already-attacker-controlled page rather than access to
another user's account. Validation is the first layer; the serving CSP is the second.

The failure mode we optimise against is **accepting a dangerous document**. Rejecting a
safe document is an acceptable cost, so the policy is deliberately conservative and
errs toward rejection on anything ambiguous.

## Error codes

Stable, machine-readable identifiers. The CLI and the API return the same codes.

| Code | Meaning |
|---|---|
| `E_SCRIPT` | A `<script>` element in any form |
| `E_FRAME` | `<iframe>`, `<frame>`, `<frameset>`, `<portal>` |
| `E_PLUGIN` | `<object>`, `<embed>`, `<applet>` |
| `E_FORM` | `<form>`, `<button type=submit>`-bearing form, `<input>`, `<textarea>`, `<select>`, `<option>` |
| `E_BASE` | `<base>` |
| `E_LINK` | `<link>` |
| `E_META_REFRESH` | `<meta http-equiv="refresh">` |
| `E_EVENT_HANDLER` | Any `on*` attribute |
| `E_DANGEROUS_URL` | `javascript:`, `vbscript:`, `data:text/html`, `file:`, `blob:` in a navigable/fetchable attribute |
| `E_SRCDOC` | `srcdoc` attribute |
| `E_DANGEROUS_CSS` | CSS `expression()`, `behavior:`, `-moz-binding`, `url(javascript:)`, `@import` |
| `E_MXSS` | Namespace-confusion / mutation-XSS constructs (`<svg><script>`, `<math><annotation-xml encoding=text/html>`, foreign-content `<style>`) |
| `E_MALFORMED` | The document does not tokenize cleanly enough to reason about |
| `E_TOO_LARGE` | Exceeds 2 MiB |
| `E_EMPTY` | Zero-length or whitespace-only document |
| `E_ENCODING` | Not valid UTF-8, or declares a non-UTF-8 charset we will not honour |
| `E_ATTR_UNSAFE` | Other unsafe attribute (`http-equiv` variants, `formaction`, `xlink:href` to a script URL, `ping`) |

## Warning codes

Non-fatal. The upload proceeds.

| Code | Meaning |
|---|---|
| `W_NO_TITLE` | No `<title>`; a generic title is substituted |
| `W_NO_DOCTYPE` | No `<!DOCTYPE html>` |
| `W_EXTERNAL_IMAGES` | References remote `https:` images (privacy / availability note) |
| `W_LARGE` | Over 512 KiB |

## Allowed

- All semantic HTML elements not listed as blocked.
- `<style>` blocks and `style="..."` attributes in the **HTML namespace**, subject to
  the `E_DANGEROUS_CSS` checks.
- `<img>` with `https:` or `data:image/*` sources.
- `<a href>` to `https:`, `http:`, `mailto:`, and same-document fragments.
- Inline SVG, except that `<script>`, event handlers, and `xlink:href` to a script URL
  inside SVG are blocked, and `<foreignObject>` is treated as HTML content.
- `<video>` / `<audio>` / `<source>` with `https:` sources.
- `<meta charset>`, `<meta name=viewport>`, `<meta name=description>`, `<title>`.
- HTML comments (but a comment may not be used to smuggle a blocked construct — see
  the parse-differential rules below).

## Parse-differential rules

These exist because a naive blocklist over raw bytes is bypassable, and because a
tokenizer that is *more* lenient than a browser is dangerous.

1. **Tokenize, do not regex.** Both implementations run a real HTML tokenizer. Element
   and attribute names come from the tokenizer, not from pattern matching.
2. **Case, entity, and whitespace normalisation for URL attributes.** Before checking a
   URL scheme: decode HTML entities, strip all ASCII whitespace and control characters
   (including NUL, TAB, LF, CR), then lowercase. `java&#x09;script:` and
   `JaVaScRiPt&colon;` are both `javascript:`.
3. **Foreign content is not HTML content.** Inside `<svg>` and `<math>`, a `<style>` or
   `<title>` does not behave as it does in the HTML namespace. Any
   `<annotation-xml encoding="text/html">`, `<svg><script>`, or foreign-namespace
   `<style>` is `E_MXSS`.
4. **`<noscript>`, `<template>`, and `<textarea>` change tokenizer state.** Content
   inside them is parsed differently by browsers with and without scripting. We reject
   `<textarea>` outright (it's a form control) and require that `<noscript>` and
   `<template>` contents pass the same checks as top-level content.
5. **Unclosed comments and bogus comments.** `<!-- <script> -->` is a comment to a
   tokenizer, but `<!--` without a `-->` swallows the rest of the document in a way
   that differs across parsers. An unterminated comment is `E_MALFORMED`.
6. **CDATA.** `<![CDATA[...]]>` is a bogus comment in HTML but real CDATA in foreign
   content. Present anywhere outside foreign content, it is `E_MALFORMED`.
7. **Raw text elements.** The tokenizer must treat `<style>` content as raw text so
   `</style><script>` inside a style block is seen as a real `</style>` followed by a
   real `<script>` — which is exactly how a browser sees it, and is `E_SCRIPT`.
8. **UTF-8 only.** The body must be valid UTF-8. A declared charset other than UTF-8 is
   `E_ENCODING`, because we serve with `charset=utf-8` and a mismatch is a known XSS
   vector (UTF-7 style attacks).
9. **Size is checked on bytes, not characters.**
