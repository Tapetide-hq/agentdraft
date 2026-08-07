// API key hashing for Workers.
//
// Keys are 40 chars of CSPRNG output (~200 bits) — NOT human passwords. There is no
// dictionary to attack and no rainbow table to precompute, so key stretching (PBKDF2/
// bcrypt) buys nothing and PBKDF2 on Workers is capped at 100k iterations anyway.
// A single domain-separated SHA-256 is the correct construction (the same shape
// Stripe/GitHub use for API tokens): fast, constant-work, one indexed DB lookup.

export async function hashApiKey(fullKey: string, pepper: string): Promise<string> {
  const data = new TextEncoder().encode(`webhost.apikey.v1|${pepper}|${fullKey}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return hex(digest);
}

export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return hex(digest);
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time comparison for secret values.
//
// Uses the runtime's crypto.subtle.timingSafeEqual rather than a hand-rolled JS loop:
// a JS loop is not guaranteed constant-time (the JIT may short-circuit) and an early
// length check leaks the secret's length. Both inputs are first hashed to a fixed
// 32-byte digest, which normalises length (so differing-length inputs compare in
// constant time) and gives timingSafeEqual the equal-length buffers it requires.
export async function secretEquals(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(da, db);
}
