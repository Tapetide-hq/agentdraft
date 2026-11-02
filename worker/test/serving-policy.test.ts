import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// The interactive sandbox is the security boundary for pages whose scripts run, and it
// is written out by hand in three places that cannot share a module: the content worker
// (public drafts), the API's private-draft path (served on the dashboard origin), and
// the dashboard preview iframe. These tests read the three copies and fail when they
// drift apart or gain a flag that breaks the boundary.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

function constString(source: string, name: string): string {
  const m = new RegExp(`const ${name} =\\s*"([^"]+)"`).exec(source);
  if (!m) throw new Error(`could not find const ${name}`);
  return m[1];
}

const flags = (policy: string) => new Set(policy.replace(/^sandbox\s+/, "").split(/\s+/));

const contentWorker = read("content-worker/src/index.ts");
const apiDrafts = read("worker/src/routes/drafts.ts");
const dashboardPreview = read("dashboard/src/routes/drafts/[id]/+page.svelte");

const copies = {
  "content worker": constString(contentWorker, "INTERACTIVE_SANDBOX"),
  "API private path": constString(apiDrafts, "INTERACTIVE_SANDBOX"),
  "dashboard iframe": constString(dashboardPreview, "INTERACTIVE_FRAME_SANDBOX"),
};

describe("interactive sandbox policy", () => {
  it("is identical in every copy", () => {
    const [first, ...rest] = Object.values(copies).map((p) => [...flags(p)].sort().join(" "));
    for (const other of rest) expect(other).toBe(first);
  });

  for (const [where, policy] of Object.entries(copies)) {
    it(`${where}: runs scripts but never as a real origin`, () => {
      const f = flags(policy);
      expect(f.has("allow-scripts")).toBe(true);
      // allow-scripts + allow-same-origin lets the page remove its own sandbox.
      expect(f.has("allow-same-origin")).toBe(false);
      // Script-built downloads would be attributed to the shared host.
      expect(f.has("allow-downloads")).toBe(false);
      // Navigating the embedding dashboard is never needed.
      expect([...f].some((x) => x.startsWith("allow-top-navigation"))).toBe(false);
    });
  }

  it("is a header directive in both server-side policies", () => {
    expect(copies["content worker"].startsWith("sandbox ")).toBe(true);
    expect(copies["API private path"].startsWith("sandbox ")).toBe(true);
  });
});
