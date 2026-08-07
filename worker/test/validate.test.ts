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
    html: string;
    expect_ok: boolean;
    expect_error_codes: string[];
    expect_warning_codes?: string[];
  }>;
};

describe("html-validator conformance corpus", () => {
  for (const c of corpus.cases) {
    it(`${c.id} (expect_ok=${c.expect_ok})`, () => {
      const r = validateHtml(c.html);
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
