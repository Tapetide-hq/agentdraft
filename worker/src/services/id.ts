import { customAlphabet } from "nanoid";

// URL-friendly, lowercase + digits (no ambiguous chars issue for our purposes).
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const gen = customAlphabet(alphabet, 32);

export function newId(prefix: string, len = 16): string {
  return `${prefix}${gen().slice(0, len)}`;
}

// Draft IDs have no prefix and appear directly in the public URL.
export function newDraftId(): string {
  return gen().slice(0, 12);
}

// A full API key: "wh_" + 40 chars of high-entropy base36. The visible prefix used
// for display/support is the first 11 chars ("wh_" + 8).
export function newApiKey(): { full: string; prefix: string } {
  const body = gen().slice(0, 40);
  const full = `wh_${body}`;
  return { full, prefix: full.slice(0, 11) };
}

export function newSessionId(): string {
  return `sess_${gen().slice(0, 24)}`;
}
