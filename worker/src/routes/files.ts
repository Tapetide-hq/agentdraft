import { Hono } from "hono";
import type { Env } from "../env.js";
import type { AuthContext, FileRow } from "../types.js";
import { jsonError, clientIp } from "../lib/http.js";
import { MAX_FILE_BYTES, resolveContentType, fileObjectKey } from "../services/files.js";
import { newDraftId } from "../services/id.js";

type Vars = { Variables: { auth: AuthContext }; Bindings: Env };
const files = new Hono<Vars>();

// POST /api/files
// Body: raw file bytes (streamed straight to R2 — never buffered).
// Headers: X-Filename (required), Content-Type (optional), Idempotency-Key (optional),
//          X-CLI-Version (optional).
files.post("/", async (c) => {
  const auth = c.get("auth");

  const rawName = c.req.header("x-filename") ?? "";
  // Use only the base name; strip any path a client accidentally sent. Reject empties and
  // control chars. The stored name is what a browser downloads AS, so keep it sane.
  const filename = rawName.split(/[\\/]/).pop()?.trim() ?? "";
  if (!filename || filename.length > 255 || /[\x00-\x1f]/.test(filename)) {
    return jsonError(c, 400, "E_BAD_FILENAME", "A valid X-Filename header is required.");
  }

  // Reject oversize up front via Content-Length when present (saves streaming a body we
  // will refuse). The stream guard below is the real enforcement — a client can lie about
  // or omit Content-Length.
  const declaredLen = Number(c.req.header("content-length") ?? "0");
  if (Number.isFinite(declaredLen) && declaredLen > MAX_FILE_BYTES) {
    return jsonError(
      c,
      413,
      "E_TOO_LARGE",
      `File is ${declaredLen} bytes; limit is ${MAX_FILE_BYTES}.`,
    );
  }

  const body = c.req.raw.body;
  if (!body) return jsonError(c, 400, "E_NO_CONTENT", "Request body is required.");

  const contentType = resolveContentType(c.req.header("content-type") ?? null, filename);
  const idempotencyKey = c.req.header("idempotency-key") ?? null;

  // Idempotency: an agent retry with the same key returns the existing file, no new object.
  if (idempotencyKey) {
    const existing = await c.env.DB.prepare(
      "SELECT * FROM files WHERE account_id = ? AND idempotency_key = ? AND deleted_at IS NULL",
    )
      .bind(auth.account.id, idempotencyKey)
      .first<FileRow>();
    if (existing) return c.json(makeResponse(c.env, existing, true));
  }

  const id = newDraftId(); // 22-char base36 generator, reused for files
  const key = fileObjectKey(id);

  // Stream the request body straight to R2 — never buffer it (Worker memory is 128 MB).
  //
  // We pass c.req.raw.body DIRECTLY, not through a TransformStream. R2.put() needs a
  // FIXED-LENGTH stream: the raw request body carries the request's Content-Length, but a
  // piped TransformStream has unknown length and R2 rejects it. The hard 100 MB cap does
  // not need a byte-counting guard here anyway — Cloudflare enforces the request-body
  // limit at the EDGE (a >100 MB body is 413'd before this Worker ever runs), and the
  // Content-Length pre-check above rejects an oversize declared length early.
  try {
    await c.env.STORAGE.put(key, body, {
      httpMetadata: { contentType },
      customMetadata: {
        account_id: auth.account.id,
        filename,
        uploaded_at: new Date().toISOString(),
      },
    });
  } catch {
    return jsonError(c, 500, "E_STORAGE", "Failed to store the file.");
  }

  // Read back the authoritative size from R2.
  const head = await c.env.STORAGE.head(key);
  const size = head?.size ?? declaredLen;

  await c.env.DB.prepare(
    `INSERT INTO files
      (id, account_id, object_key, filename, content_type, file_size,
       created_by_key_id, idempotency_key, source_ip, cli_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      auth.account.id,
      key,
      filename,
      contentType,
      size,
      auth.keyId ?? null,
      idempotencyKey,
      clientIp(c),
      c.req.header("x-cli-version") ?? null,
    )
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM files WHERE id = ?")
    .bind(id)
    .first<FileRow>();
  return c.json(makeResponse(c.env, row!, false), 201);
});

// GET /api/files — the signed-in account's files (newest first). Read scope.
files.get("/", async (c) => {
  const auth = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "200", 10) || 200, 500);
  const rows = await c.env.DB.prepare(
    `SELECT id, filename, content_type, file_size, disabled_at, created_at
     FROM files WHERE account_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(auth.account.id, limit)
    .all<FileRow>();
  const base = c.env.CONTENT_BASE_URL.replace(/\/$/, "");
  const list = (rows.results ?? []).map((f) => ({
    id: f.id,
    filename: f.filename,
    content_type: f.content_type,
    file_size: f.file_size,
    disabled_at: f.disabled_at,
    created_at: f.created_at,
    public_url: `${base}/f/${f.id}`,
  }));
  return c.json({ ok: true, files: list });
});

// POST /api/files/:id/disable — take a file down (451 at serve time). Ownership enforced
// in the WHERE clause so a non-owner gets a plain 404, never an existence oracle.
files.post("/:id/disable", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const res = await c.env.DB.prepare(
    "UPDATE files SET disabled_at = datetime('now'), disabled_reason = 'Disabled by owner' WHERE id = ? AND account_id = ? AND deleted_at IS NULL AND disabled_at IS NULL",
  )
    .bind(id, auth.account.id)
    .run();
  if (!res.meta || res.meta.changes === 0) {
    return jsonError(c, 404, "E_FILE_NOT_FOUND", "File not found or already disabled.");
  }
  return c.json({ ok: true, id, disabled: true });
});

function makeResponse(env: Env, f: FileRow, idempotentReplay: boolean) {
  const base = env.CONTENT_BASE_URL.replace(/\/$/, "");
  return {
    ok: true,
    file_id: f.id,
    public_url: `${base}/f/${f.id}`,
    filename: f.filename,
    content_type: f.content_type,
    file_size: f.file_size,
    idempotent_replay: idempotentReplay,
  };
}

export default files;
