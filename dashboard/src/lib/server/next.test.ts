import { describe, it, expect } from "vitest";
import { safeNext } from "./next";

// An unvalidated `next` is an OPEN REDIRECT: our own sign-in page bounces a victim
// off-site after they authenticate, with our domain lending it credibility. This suite
// exists to prove the guard REJECTS things, so every case below asserts the fallback.
//
// WHICH GUARD IS LOAD-BEARING (established by mutation testing, not by reading the code).
// Deleting `startsWith("//")` from safeNext leaves ALL 31 tests passing, because a string
// beginning "//" can never begin "/private/d/" either — the ALLOW-LIST is what actually
// rejects scheme-relative URLs. Deleting the allow-list instead fails 2 tests immediately.
// So the allow-list is the real defence and the "//" check is redundant belt-and-braces.
//
// That matters for anyone editing this: if you ever relax ALLOWED_PREFIXES to something
// permissive, the "//" check alone will NOT save you from the encoded and backslash
// variants below. Re-run the allow-list mutation after any change here.

const FALLBACK = "/dashboard";

describe("safeNext — hostile input must collapse to the fallback", () => {
  const hostile: [string, string][] = [
    ["absolute http", "http://evil.example/"],
    ["absolute https", "https://evil.example/"],
    ["scheme-relative (the most-missed case)", "//evil.example/"],
    ["scheme-relative with path", "//evil.example/private/d/abc123"],
    ["backslash escape", "/\\evil.example"],
    ["double backslash", "\\\\evil.example"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,<script>alert(1)</script>"],
    ["encoded double slash", "/%2f%2fevil.example"],
    ["encoded backslash", "/%5cevil.example"],
    ["embedded newline", "/private/d/abc\n//evil.example"],
    ["embedded CR", "/private/d/abc\r//evil.example"],
    ["embedded tab", "/private/d/abc\t"],
    ["leading space", " /private/d/abc123"],
    ["NUL byte", "/private/d/abc\u0000"],
    ["protocol-ish colon", "/private/d/a:b"],
    ["not a served prefix", "/etc/passwd"],
    ["bare relative", "private/d/abc123"],
    ["empty string", ""],
    ["just a slash", "/"],
  ];

  for (const [label, input] of hostile) {
    it(`rejects ${label}`, () => {
      expect(safeNext(input)).toBe(FALLBACK);
    });
  }

  it("rejects null and undefined", () => {
    expect(safeNext(null)).toBe(FALLBACK);
    expect(safeNext(undefined)).toBe(FALLBACK);
  });
});

describe("safeNext — legitimate return targets must survive", () => {
  const allowed = [
    "/private/d/abc123def456",
    "/private/d/abc123def456/v/2",
    "/private/d/abc123def456/raw",
    // 22-char id (the new higher-entropy format)
    "/private/d/abcdefghij0123456789kl",
    "/drafts/abc123def456",
    "/dashboard",
    "/projects",
    "/settings/keys",
  ];

  for (const path of allowed) {
    it(`preserves ${path}`, () => {
      expect(safeNext(path)).toBe(path);
    });
  }

  it("honours a custom fallback", () => {
    expect(safeNext("http://evil.example", "/login")).toBe("/login");
  });

  it("returns an empty fallback when asked (used to mean 'no next')", () => {
    expect(safeNext(null, "")).toBe("");
    expect(safeNext("//evil.example", "")).toBe("");
  });
});
