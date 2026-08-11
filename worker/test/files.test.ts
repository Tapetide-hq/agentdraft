import { describe, it, expect } from "vitest";
import {
  isInlineType,
  resolveContentType,
  mimeFromFilename,
  contentDisposition,
  fileObjectKey,
  MAX_FILE_BYTES,
  INLINE_ALLOWLIST,
} from "../src/services/files.js";

// The file lane's safety rests entirely on these pure functions: which MIME types serve
// inline, and how a served file is dispositioned. If any of these regress, an uploaded
// "file" could execute as a page on the shared document origin — so they are the highest
// value unit under test.

describe("isInlineType — the inline allowlist gate", () => {
  it("allows the safe media types inline", () => {
    for (const t of ["image/png", "image/jpeg", "image/gif", "image/webp", "video/mp4", "application/pdf", "text/plain"]) {
      expect(isInlineType(t), `${t} should be inline`).toBe(true);
    }
  });

  it("NEVER serves html or svg inline (the core XSS gate)", () => {
    expect(isInlineType("text/html")).toBe(false);
    expect(isInlineType("image/svg+xml")).toBe(false);
    expect(isInlineType("application/xhtml+xml")).toBe(false);
    expect(isInlineType("application/xml")).toBe(false);
  });

  it("forces unknown/binary types to download", () => {
    expect(isInlineType("application/octet-stream")).toBe(false);
    expect(isInlineType("application/zip")).toBe(false);
    expect(isInlineType("application/x-executable")).toBe(false);
  });

  it("ignores charset parameters and case when matching", () => {
    expect(isInlineType("text/plain; charset=utf-8")).toBe(true);
    expect(isInlineType("IMAGE/PNG")).toBe(true);
    expect(isInlineType("  image/jpeg  ")).toBe(true);
  });

  it("does not let a lookalike type sneak in", () => {
    expect(isInlineType("text/html; image/png")).toBe(false);
    expect(isInlineType("image/png-evil")).toBe(false);
  });
});

describe("mimeFromFilename — extension fallback", () => {
  it("maps known extensions", () => {
    expect(mimeFromFilename("shot.png")).toBe("image/png");
    expect(mimeFromFilename("clip.mp4")).toBe("video/mp4");
    expect(mimeFromFilename("notes.log")).toBe("text/plain");
    expect(mimeFromFilename("archive.zip")).toBe("application/zip");
    expect(mimeFromFilename("doc.pdf")).toBe("application/pdf");
  });

  it("maps html/svg to their real types (so the SERVE gate can catch them)", () => {
    expect(mimeFromFilename("page.html")).toBe("text/html");
    expect(mimeFromFilename("vector.svg")).toBe("image/svg+xml");
  });

  it("falls back to octet-stream for unknown or missing extensions", () => {
    expect(mimeFromFilename("mystery.xyz")).toBe("application/octet-stream");
    expect(mimeFromFilename("noext")).toBe("application/octet-stream");
  });

  it("is case-insensitive on the extension", () => {
    expect(mimeFromFilename("SHOT.PNG")).toBe("image/png");
  });
});

describe("resolveContentType — client type vs fallback", () => {
  it("trusts a non-blank client type", () => {
    expect(resolveContentType("image/webp", "x.bin")).toBe("image/webp");
  });

  it("falls back to extension when the client type is blank or octet-stream", () => {
    expect(resolveContentType("", "shot.png")).toBe("image/png");
    expect(resolveContentType("application/octet-stream", "shot.png")).toBe("image/png");
    expect(resolveContentType(null, "clip.mp4")).toBe("video/mp4");
  });

  it("strips charset from a client type", () => {
    expect(resolveContentType("text/plain; charset=utf-8", "x.bin")).toBe("text/plain");
  });
});

describe("contentDisposition", () => {
  it("emits inline or attachment with an ascii fallback and rfc5987 name", () => {
    expect(contentDisposition("inline", "shot.png")).toBe(
      `inline; filename="shot.png"; filename*=UTF-8''shot.png`,
    );
    expect(contentDisposition("attachment", "report.zip")).toBe(
      `attachment; filename="report.zip"; filename*=UTF-8''report.zip`,
    );
  });

  it("neutralizes quotes, backslashes, and control chars in the ascii fallback", () => {
    const out = contentDisposition("attachment", 'a"b\\c.txt');
    expect(out).toContain(`filename="a_b_c.txt"`);
    // header-injection attempt must not survive into the fallback
    expect(out).not.toContain('"a"b');
  });

  it("percent-encodes non-ascii names in filename*", () => {
    const out = contentDisposition("inline", "résumé.pdf");
    expect(out).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9.pdf");
    // ascii fallback must not carry raw non-ascii bytes
    expect(out).toContain(`filename="r_sum_.pdf"`);
  });
});

describe("fileObjectKey + constants", () => {
  it("namespaces file keys under files/ so they never collide with drafts/", () => {
    expect(fileObjectKey("abc123")).toBe("files/abc123");
    expect(fileObjectKey("abc123").startsWith("drafts/")).toBe(false);
  });

  it("caps files at 100 MiB", () => {
    expect(MAX_FILE_BYTES).toBe(100 * 1024 * 1024);
  });

  it("the allowlist contains no active-content types", () => {
    expect(INLINE_ALLOWLIST.has("text/html")).toBe(false);
    expect(INLINE_ALLOWLIST.has("image/svg+xml")).toBe(false);
    expect(INLINE_ALLOWLIST.has("application/javascript")).toBe(false);
  });
});
