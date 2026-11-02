import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { validateHtml } from "../src/services/html-validator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(__dirname, "../../shared/html-policy-fixtures.json"), "utf-8"),
) as {
  cases: Array<{
    id: string;
    mode?: "interactive";
    html: string;
    expect_ok: boolean;
    expect_error_codes: string[];
    expect_warning_codes?: string[];
  }>;
};

describe("html-validator conformance corpus", () => {
  for (const c of corpus.cases) {
    it(`${c.id} (expect_ok=${c.expect_ok})`, () => {
      const r = validateHtml(c.html, { interactive: c.mode === "interactive" });
      const codes = r.errors.map((e) => e.code);
      if (c.expect_ok) {
        expect(r.ok, `expected OK but got errors: ${JSON.stringify(codes)}`).toBe(true);
      } else {
        expect(r.ok, `expected rejection for ${c.id}`).toBe(false);
        for (const want of c.expect_error_codes) {
          expect(codes, `${c.id} missing error code ${want}; got ${JSON.stringify(codes)}`).toContain(want);
        }
      }
    });
  }
});

// The two modes must actually differ, in both directions. Without these, a validator
// that ignored the option entirely would still pass the corpus above.
describe("interactive render mode", () => {
  const TRANSPORT = new Set(["E_EMPTY", "E_TOO_LARGE", "E_ENCODING"]);
  const staticBlocks = corpus.cases.filter(
    (c) => !c.mode && !c.expect_ok && c.expect_error_codes.every((code) => !TRANSPORT.has(code)),
  );
  const interactiveOks = corpus.cases.filter((c) => c.mode === "interactive" && c.expect_ok);

  it("has cases to compare", () => {
    expect(staticBlocks.length).toBeGreaterThan(10);
    expect(interactiveOks.length).toBeGreaterThan(0);
  });

  for (const c of staticBlocks) {
    it(`accepts static-policy rejection ${c.id} when interactive`, () => {
      const r = validateHtml(c.html, { interactive: true });
      expect(r.ok, `got ${JSON.stringify(r.errors.map((e) => e.code))}`).toBe(true);
    });
  }

  for (const c of interactiveOks) {
    it(`rejects interactive case ${c.id} in static mode`, () => {
      expect(validateHtml(c.html).ok).toBe(false);
    });
  }

  it("still extracts the title", () => {
    const r = validateHtml(
      "<!DOCTYPE html><html><head><title>Live chart</title></head><body><script>1</script></body></html>",
      { interactive: true },
    );
    expect(r.title).toBe("Live chart");
  });

  it("still enforces the size limit", () => {
    const big = "<!DOCTYPE html><title>x</title>" + "a".repeat(2 * 1024 * 1024);
    const codes = validateHtml(big, { interactive: true }).errors.map((e) => e.code);
    expect(codes).toContain("E_TOO_LARGE");
  });
});
