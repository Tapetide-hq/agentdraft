// The single authoritative HTML validation gate for AgentDraft.
//
// Uses parse5 (a spec-compliant HTML5 tree parser) so element/attribute/namespace
// semantics match what a browser actually does — a regex/blocklist over raw bytes is
// bypassable and is explicitly rejected by the design (see shared/html-policy.md).
//
// We parse ONLY to accept/reject. We never re-serialize: stored bytes are the exact
// uploaded bytes. The failure mode we optimise against is accepting a dangerous
// document; rejecting a safe one is an acceptable cost, so the policy errs toward
// rejection on anything ambiguous.

import { parse, parseFragment } from "parse5";
import type {
  DefaultTreeAdapterMap,
} from "parse5";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
type ParentNode = DefaultTreeAdapterMap["parentNode"];
type ChildNode = DefaultTreeAdapterMap["childNode"];
type CommentNode = DefaultTreeAdapterMap["commentNode"];

export const MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
const WARN_BYTES = 512 * 1024;
const LARGE_WARN_BYTES = 512 * 1024;

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  title: string | null;
}

export interface ValidationError {
  code: string;
  message: string;
}
export interface ValidationWarning {
  code: string;
  message: string;
}

const HTML_NS = "http://www.w3.org/1999/xhtml";
const SVG_NS = "http://www.w3.org/2000/svg";
const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

// Elements rejected outright, mapped to error code.
const BLOCKED_TAGS: Record<string, string> = {
  script: "E_SCRIPT",
  iframe: "E_FRAME",
  frame: "E_FRAME",
  frameset: "E_FRAME",
  portal: "E_FRAME",
  object: "E_PLUGIN",
  embed: "E_PLUGIN",
  applet: "E_PLUGIN",
  form: "E_FORM",
  input: "E_FORM",
  textarea: "E_FORM",
  select: "E_FORM",
  option: "E_FORM",
  optgroup: "E_FORM",
  button: "E_FORM",
  fieldset: "E_FORM",
  datalist: "E_FORM",
  output: "E_FORM",
  base: "E_BASE",
  link: "E_LINK",
};

// Attributes that carry a navigable/fetchable URL and must be scheme-checked.
const URL_ATTRS = new Set([
  "href",
  "src",
  "srcset",
  "action",
  "formaction",
  "data",
  "poster",
  "background",
  "cite",
  "xlink:href",
]);

// Attributes that are unsafe regardless of value.
const UNSAFE_ATTRS = new Set(["srcdoc", "ping"]);

const DANGEROUS_SCHEMES = ["javascript:", "vbscript:", "file:", "blob:", "data:text/html"];

// Decode HTML numeric + a few named entities enough to defeat scheme obfuscation,
// then strip all ASCII whitespace/control chars and lowercase. This is deliberately
// aggressive: we only use the normalized form for scheme detection, never for storage.
function normalizeUrl(raw: string): string {
  let s = raw;
  // numeric entities: &#x09; &#9;
  s = s.replace(/&#x([0-9a-fA-F]+);?/g, (_, h) => {
    const cp = parseInt(h, 16);
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
  });
  s = s.replace(/&#(\d+);?/g, (_, d) => {
    const cp = parseInt(d, 10);
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
  });
  // a handful of named entities used in bypasses
  const named: Record<string, string> = {
    "&colon;": ":",
    "&Tab;": "\t",
    "&NewLine;": "\n",
    "&lpar;": "(",
    "&rpar;": ")",
  };
  for (const [k, v] of Object.entries(named)) s = s.split(k).join(v);
  // strip ALL ascii whitespace + control chars (incl NUL, TAB, LF, CR, FF, VT)
  s = s.replace(/[\u0000-\u0020\u007f]/g, "");
  return s.toLowerCase();
}

function isDangerousUrl(raw: string): boolean {
  const n = normalizeUrl(raw);
  return DANGEROUS_SCHEMES.some((scheme) => n.startsWith(scheme));
}

// Detect dangerous CSS constructs in a style block or style attribute.
function dangerousCss(css: string): boolean {
  const lower = css.toLowerCase().replace(/\/\*[\s\S]*?\*\//g, "");
  if (/expression\s*\(/.test(lower)) return true;
  if (/behavior\s*:/.test(lower)) return true;
  if (/-moz-binding\s*:/.test(lower)) return true;
  if (/@import/.test(lower)) return true;
  // url(javascript:...) with optional quotes/whitespace
  if (/url\s*\(\s*['"]?\s*(javascript|vbscript):/.test(lower)) return true;
  return false;
}

function tagName(el: Element): string {
  return el.tagName.toLowerCase();
}

function nsOf(el: Element): string {
  // parse5 stores namespaceURI on elements
  return (el as unknown as { namespaceURI: string }).namespaceURI ?? HTML_NS;
}

function isElement(n: Node): n is Element {
  return typeof (n as Element).tagName === "string";
}
function isComment(n: Node): n is CommentNode {
  return (n as { nodeName?: string }).nodeName === "#comment";
}

function children(n: Node): ChildNode[] {
  return ((n as ParentNode).childNodes as ChildNode[]) ?? [];
}

function getAttr(el: Element, name: string): string | undefined {
  const a = el.attrs.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return a?.value;
}

// Raw-text extraction for <style> (parse5 gives style content as a text child).
function textContent(el: Element): string {
  let out = "";
  for (const c of children(el)) {
    if ((c as { nodeName?: string }).nodeName === "#text") {
      out += (c as unknown as { value: string }).value;
    }
  }
  return out;
}

export function validateHtml(input: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const seen = new Set<string>();
  const addErr = (code: string, message: string) => {
    if (seen.has(code)) return; // one of each code is enough
    seen.add(code);
    errors.push({ code, message });
  };
  let title: string | null = null;

  // ---- byte / encoding / size checks ----
  const bytes = new TextEncoder().encode(input);
  if (input.trim().length === 0) {
    return { ok: false, errors: [{ code: "E_EMPTY", message: "Document is empty." }], warnings: [], title: null };
  }
  if (bytes.length > MAX_BYTES) {
    addErr("E_TOO_LARGE", `Document is ${bytes.length} bytes; limit is ${MAX_BYTES}.`);
  }
  if (input.includes("\u0000")) {
    addErr("E_ENCODING", "Document contains a NUL byte.");
  }

  // ---- pre-parse raw-source checks for constructs parse5 normalizes away ----
  // Unterminated comment: an opened <!-- with no matching --> before EOF.
  const firstOpen = input.indexOf("<!--");
  if (firstOpen !== -1 && input.indexOf("-->", firstOpen + 4) === -1) {
    addErr("E_MALFORMED", "Unterminated HTML comment.");
  }
  // CDATA sections in HTML content are bogus comments in HTML; treat as malformed
  // (they are only legal inside foreign SVG/MathML content, which we reject anyway).
  if (/<!\[CDATA\[/.test(input)) {
    addErr("E_MALFORMED", "CDATA section present in HTML content.");
  }

  // ---- charset declaration check ----
  const charsetMatch = input.match(/<meta[^>]*charset\s*=\s*["']?\s*([a-z0-9\-_:]+)/i);
  if (charsetMatch) {
    const cs = charsetMatch[1].toLowerCase();
    if (cs !== "utf-8" && cs !== "utf8") {
      addErr("E_ENCODING", `Declared charset "${cs}" is not utf-8.`);
    }
  }

  // ---- parse ----
  let doc: Node;
  try {
    // Full document if it looks like one, else fragment. Either way parse5 builds a tree.
    doc = /<html[\s>]/i.test(input) || /<!doctype/i.test(input) ? (parse(input) as unknown as Node) : (parseFragment(input) as unknown as Node);
  } catch (e) {
    addErr("E_MALFORMED", "Document failed to parse.");
    return { ok: errors.length === 0, errors, warnings, title };
  }

  let hasDoctype = /<!doctype/i.test(input);
  let externalImages = false;

  const walk = (node: Node, inForeign: boolean) => {
    for (const child of children(node)) {
      if (isComment(child)) continue;
      if (!isElement(child)) continue;
      const el = child;
      const name = tagName(el);
      const ns = nsOf(el);
      const foreign = inForeign || ns === SVG_NS || ns === MATHML_NS;

      // mXSS / namespace confusion
      if (ns === MATHML_NS && name === "annotation-xml") {
        const enc = (getAttr(el, "encoding") ?? "").toLowerCase();
        if (enc === "text/html" || enc === "application/xhtml+xml") {
          addErr("E_MXSS", "MathML annotation-xml with HTML encoding (mutation-XSS vector).");
        }
      }
      // script anywhere (incl. inside SVG foreign content) — flag both for svg case
      if (name === "script") {
        addErr("E_SCRIPT", "Blocked <script> element.");
        if (foreign) addErr("E_MXSS", "Script inside foreign (SVG/MathML) content.");
      } else if (BLOCKED_TAGS[name]) {
        addErr(BLOCKED_TAGS[name], `Blocked <${name}> element.`);
      }

      // <template> content is parsed into a separate `content` fragment by parse5,
      // not into childNodes. A browser instantiates it as real markup, so validate it.
      const tplContent = (el as unknown as { content?: Node }).content;
      if (name === "template" && tplContent) {
        walk(tplContent, foreign);
      }

      // <noscript> with scripting enabled holds its body as RAW TEXT. A JS-disabled
      // browser parses that text as live markup, so re-parse and validate it — this is
      // exactly the parse-differential the policy warns about.
      if (name === "noscript") {
        const inner = textContent(el);
        if (inner.trim()) {
          try {
            walk(parseFragment(inner) as unknown as Node, foreign);
          } catch {
            addErr("E_MALFORMED", "noscript content failed to parse.");
          }
        }
      }

      // <style> content (HTML namespace only; foreign <style> is an mXSS integration point)
      if (name === "style") {
        if (foreign) {
          addErr("E_MXSS", "<style> inside foreign content (integration-point mutation vector).");
        } else if (dangerousCss(textContent(el))) {
          addErr("E_DANGEROUS_CSS", "Dangerous CSS construct in <style> block.");
        }
      }

      // <title> capture (first one, HTML namespace)
      if (name === "title" && !foreign && title === null) {
        title = textContent(el).trim() || null;
      }

      // <meta http-equiv>
      if (name === "meta") {
        const he = (getAttr(el, "http-equiv") ?? "").toLowerCase();
        if (he === "refresh") addErr("E_META_REFRESH", "Blocked <meta http-equiv=refresh>.");
        else if (he) addErr("E_ATTR_UNSAFE", `Blocked <meta http-equiv="${he}">.`);
      }

      // attribute checks
      for (const attr of el.attrs) {
        const an = attr.name.toLowerCase();
        const av = attr.value;
        if (an.startsWith("on")) {
          addErr("E_EVENT_HANDLER", `Blocked inline event handler "${an}".`);
        }
        if (UNSAFE_ATTRS.has(an)) {
          addErr(an === "srcdoc" ? "E_SRCDOC" : "E_ATTR_UNSAFE", `Blocked attribute "${an}".`);
        }
        if (an === "style" && dangerousCss(av)) {
          addErr("E_DANGEROUS_CSS", "Dangerous CSS construct in style attribute.");
        }
        if (URL_ATTRS.has(an) && isDangerousUrl(av)) {
          addErr("E_DANGEROUS_URL", `Blocked dangerous URL scheme in "${an}".`);
        }
        if (an === "src" && name === "img" && /^https:\/\//i.test(av.trim())) {
          externalImages = true;
        }
      }

      walk(el, foreign);
    }
  };

  walk(doc, false);

  // ---- warnings ----
  if (title === null && errors.length === 0) {
    warnings.push({ code: "W_NO_TITLE", message: "No <title>; a generic title will be used." });
  }
  if (!hasDoctype && errors.length === 0) {
    warnings.push({ code: "W_NO_DOCTYPE", message: "No <!DOCTYPE html>." });
  }
  if (externalImages) {
    warnings.push({ code: "W_EXTERNAL_IMAGES", message: "References remote https: images." });
  }
  if (bytes.length > LARGE_WARN_BYTES) {
    warnings.push({ code: "W_LARGE", message: "Document is over 512 KiB." });
  }

  return { ok: errors.length === 0, errors, warnings, title };
}
