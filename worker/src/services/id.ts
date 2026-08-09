import { customAlphabet } from "nanoid";

// URL-friendly, lowercase + digits (no ambiguous chars issue for our purposes).
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const gen = customAlphabet(alphabet, 32);

export function newId(prefix: string, len = 16): string {
  return `${prefix}${gen().slice(0, len)}`;
}

// Draft IDs have no prefix and appear directly in the public URL.
//
// 22 chars of base36 is ~113 bits. The previous 12 chars was ~62 bits, which was already
// not enumerable in practice (at 100k req/s against 100k drafts an attacker averages
// ~7.5 years to a first hit, before any rate limiting). This is therefore defence in
// depth, NOT the privacy mechanism — a leaked URL is readable at any entropy, so real
// access control (is_public + owner check) is what actually makes a draft private.
//
// EXISTING 12-CHAR IDS KEEP WORKING and are NOT migrated: people have already shared
// those links. The content worker's route regex accepts 6..32 chars, so old and new
// coexist permanently. Do not "clean this up" by rewriting old ids.
export function newDraftId(): string {
  return gen().slice(0, 22);
}

// A full API key: "ad_" + 40 chars of high-entropy base36. The visible prefix used
// for display/support is the first 11 chars ("ad_" + 8).
export function newApiKey(): { full: string; prefix: string } {
  const body = gen().slice(0, 40);
  const full = `ad_${body}`;
  return { full, prefix: full.slice(0, 11) };
}

export function newSessionId(): string {
  return `sess_${gen().slice(0, 24)}`;
}
