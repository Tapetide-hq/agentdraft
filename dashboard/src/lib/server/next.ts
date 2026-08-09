// Validate a `?next=` return-to path.
//
// WHY THIS IS ITS OWN MODULE. An unvalidated `next` is a textbook OPEN REDIRECT: an
// attacker sends `/login?next=https://evil.example/` and our own sign-in page bounces the
// victim off-site after they authenticate, with our domain in the referrer chain lending
// it credibility.
//
// Rules, all of which must hold:
//   * must start with a single "/" — anything else is absolute or scheme-relative
//   * must NOT start with "//" — that is scheme-relative and resolves OFF-ORIGIN
//     (https://evil.com), the single most-missed case
//   * must NOT contain a backslash — some browsers normalise "\" to "/", so "/\evil.com"
//     has historically escaped naive checks
//   * must NOT contain a control character or whitespace — used to smuggle past filters
//   * must be a path we actually serve a document from
//
// Returns the safe path, or the fallback when anything is off. Never throws: a malformed
// `next` should quietly land the user somewhere sensible, not error.

const FALLBACK = "/dashboard";

// Only these prefixes are accepted as return targets. An allow-list beats a deny-list
// here: a new externally-reachable route cannot accidentally become a redirect target.
const ALLOWED_PREFIXES = ["/private/d/", "/drafts/", "/dashboard", "/projects", "/settings"];

export function safeNext(raw: string | null | undefined, fallback = FALLBACK): string {
  if (!raw) return fallback;
  // Reject control chars, spaces, tabs, newlines outright.
  if (/[\u0000-\u0020\u007f]/.test(raw)) return fallback;
  if (raw.includes("\\")) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  // Defensive: a URL-encoded scheme or host that survived one decode pass.
  const lowered = raw.toLowerCase();
  if (lowered.includes(":") || lowered.includes("%2f%2f") || lowered.includes("%5c")) {
    return fallback;
  }
  if (!ALLOWED_PREFIXES.some((p) => raw === p || raw.startsWith(p))) return fallback;
  return raw;
}
