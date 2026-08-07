import { Hono } from "hono";
import type { Env } from "../env.js";
import type { AuthContext, Draft, DraftVersion } from "../types.js";
import { validateHtml, MAX_BYTES } from "../services/html-validator.js";
import { renderMarkdown, isMarkdownUpload, MAX_MD_BYTES } from "../services/markdown.js";
import { objectKey, renderedKey, putHtml } from "../services/storage.js";
import { newDraftId, newId } from "../services/id.js";
import { sha256Hex } from "../services/crypto.js";
import { jsonError, clientIp, readJsonObject, badStringField } from "../lib/http.js";

type Vars = { Variables: { auth: AuthContext }; Bindings: Env };

const upload = new Hono<Vars>();

// POST /api/upload
// Body: { html, filename?, project_id?, draft_id?, title?, description?, metadata? }
// Header: Idempotency-Key (optional) — dedupes agent retries.
upload.post("/", async (c) => {
  const auth = c.get("auth");
  const parsedBody = await readJsonObject(c);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const badField = badStringField(c, body, [
    "html", "markdown", "format", "draft_id", "project_id", "title", "description", "filename",
  ]);
  if (badField) return badField;

  if (
    body.metadata !== undefined &&
    body.metadata !== null &&
    (typeof body.metadata !== "object" || Array.isArray(body.metadata))
  ) {
    return jsonError(c, 400, "E_BAD_FIELD", "Field 'metadata' must be an object.");
  }

  // Accept EITHER `html` or `markdown`. `markdown` may also arrive in `html` when the
  // caller sets format:"md" or uploads a .md filename — the CLI just sends file bytes
  // and lets the server decide, so we must handle both shapes.
  const rawHtmlField = typeof body.html === "string" ? body.html : "";
  const rawMdField = typeof body.markdown === "string" ? body.markdown : "";
  const treatAsMarkdown =
    rawMdField.length > 0 || isMarkdownUpload(body.format, body.filename);

  const source = rawMdField || rawHtmlField;
  if (!source) {
    return jsonError(c, 400, "E_NO_CONTENT", "Field 'html' or 'markdown' is required.");
  }

  // `source` is what we STORE (byte-for-byte, served at /raw). `html` is what we
  // VALIDATE and what the browser gets at /d/:id. For HTML uploads they are identical.
  let html: string;
  let sourceFormat: "html" | "md";
  let renderedTitle: string | null = null;

  if (treatAsMarkdown) {
    sourceFormat = "md";
    const mdBytes = new TextEncoder().encode(source).length;
    if (mdBytes > MAX_MD_BYTES) {
      return c.json(
        {
          ok: false,
          error: { code: "E_VALIDATION", message: "Markdown source rejected." },
          errors: [
            {
              code: "E_TOO_LARGE",
              message: `Markdown is ${mdBytes} bytes; limit is ${MAX_MD_BYTES}.`,
            },
          ],
          warnings: [],
        },
        422,
      );
    }
    const rendered = renderMarkdown(
      source,
      typeof body.title === "string" ? body.title : null,
    );
    html = rendered.html;
    renderedTitle = rendered.title;
  } else {
    sourceFormat = "html";
    html = source;
  }

  // (1) validate — the single authoritative gate.
  //
  // For Markdown this validates the RENDERED output, not the source. Markdown allows
  // raw HTML passthrough, so a .md file containing <script> produces a real script tag.
  // Rendering is NOT sanitising: the validator is what decides, exactly as for a direct
  // HTML upload.
  const result = validateHtml(html);
  if (!result.ok) {
    return c.json(
      {
        ok: false,
        error: {
          code: "E_VALIDATION",
          message:
            sourceFormat === "md"
              ? "Rendered Markdown rejected by validation policy (raw HTML in the source?)."
              : "HTML rejected by validation policy.",
        },
        errors: result.errors,
        warnings: result.warnings,
        source_format: sourceFormat,
      },
      422,
    );
  }

  // Hash and size describe the STORED bytes (the source), which is what /raw serves
  // and what dedup must key on — hashing the rendered form would make a source edit
  // that renders identically look like a duplicate.
  const bytes = new TextEncoder().encode(source);
  const contentHash = await sha256Hex(source);
  const idempotencyKey = c.req.header("idempotency-key") ?? null;
  const filename = typeof body.filename === "string" ? body.filename : null;
  const description = typeof body.description === "string" ? body.description : null;
  const overrideTitle = typeof body.title === "string" ? body.title : null;
  const title = overrideTitle ?? renderedTitle ?? result.title ?? "Untitled";
  const meta = (body.metadata ?? {}) as Record<string, unknown>;

  // Resolve or create the draft, verifying ownership.
  let draft: Draft | null = null;
  const reqDraftId = typeof body.draft_id === "string" ? body.draft_id : null;
  if (reqDraftId) {
    draft = await c.env.DB.prepare("SELECT * FROM drafts WHERE id = ? AND deleted_at IS NULL")
      .bind(reqDraftId)
      .first<Draft>();
    if (!draft) return jsonError(c, 404, "E_DRAFT_NOT_FOUND", "draft_id not found.");
    if (draft.account_id !== auth.account.id)
      return jsonError(c, 403, "E_FORBIDDEN", "You do not own this draft.");
  }

  // Optional project ownership check.
  let projectId: string | null = typeof body.project_id === "string" ? body.project_id : null;
  if (projectId) {
    const proj = await c.env.DB.prepare(
      "SELECT id FROM projects WHERE id = ? AND account_id = ? AND archived_at IS NULL",
    )
      .bind(projectId, auth.account.id)
      .first<{ id: string }>();
    if (!proj) return jsonError(c, 404, "E_PROJECT_NOT_FOUND", "project_id not found.");
  }

  if (!draft) {
    const id = newDraftId();
    await c.env.DB.prepare(
      "INSERT INTO drafts (id, project_id, account_id, title, description, last_allocated_version) VALUES (?, ?, ?, ?, ?, 0)",
    )
      .bind(id, projectId, auth.account.id, title, description)
      .run();
    draft = await c.env.DB.prepare("SELECT * FROM drafts WHERE id = ?")
      .bind(id)
      .first<Draft>();
    if (!draft) return jsonError(c, 500, "E_INTERNAL", "Failed to create draft.");
  }

  // Idempotency: if this draft already saw this idempotency key, return that version.
  if (idempotencyKey) {
    const existing = await c.env.DB.prepare(
      "SELECT * FROM draft_versions WHERE draft_id = ? AND idempotency_key = ?",
    )
      .bind(draft.id, idempotencyKey)
      .first<DraftVersion>();
    if (existing) {
      return c.json(makeResponse(c.env, draft.id, existing, result.warnings, true));
    }
  }

  // (2) atomically allocate a version number (UPDATE ... RETURNING). Race-free.
  const allocated = await c.env.DB.prepare(
    "UPDATE drafts SET last_allocated_version = last_allocated_version + 1, updated_at = datetime('now') WHERE id = ? AND account_id = ? RETURNING last_allocated_version",
  )
    .bind(draft.id, auth.account.id)
    .first<{ last_allocated_version: number }>();
  if (!allocated) return jsonError(c, 500, "E_INTERNAL", "Version allocation failed.");
  const versionNumber = allocated.last_allocated_version;
  const versionId = newId("ver_");

  // (3) Content deduplication. Re-uploading unchanged bytes is the common case for an
  // agent that regenerates a document each run. If this draft already stored an object
  // with the same content hash, REUSE that object key: we skip the R2 write (a Class A
  // op) and store no duplicate bytes, while still recording a new version row so the
  // history and its metadata (git sha, timestamp) stay accurate.
  //
  // Scoped per-draft on purpose: sharing objects across drafts would make one draft's
  // deletion able to break another's content.
  const dupe = await c.env.DB.prepare(
    "SELECT object_key FROM draft_versions WHERE draft_id = ? AND content_hash = ? LIMIT 1",
  )
    .bind(draft.id, contentHash)
    .first<{ object_key: string }>();

  let key: string;
  let deduped = false;
  if (dupe) {
    // Trust the row only if the object is genuinely still present — a stale row
    // pointing at a deleted object would produce a 404 on a live public URL.
    const stillThere = await c.env.STORAGE.head(dupe.object_key);
    if (stillThere) {
      key = dupe.object_key;
      deduped = true;
    } else {
      key = objectKey(draft.id, versionId);
    }
  } else {
    key = objectKey(draft.id, versionId);
  }

  // R2 PUT BEFORE the D1 row. An orphan R2 object is harmless garbage; a D1 row
  // pointing at a missing object is a 500 on a public URL. Never invert this ordering.
  //
  // Markdown stores TWO objects: the exact source bytes (served at /raw, preserving the
  // byte-for-byte guarantee) and the rendered HTML (served at /d/:id so a human can
  // read it in a browser). Rendering at request time instead would mean a `marked`
  // upgrade could silently change an already-published document.
  if (!deduped) {
    await putHtml(c.env, key, source, {
      draft_id: draft.id,
      version_number: String(versionNumber),
      content_hash: contentHash,
      source_format: sourceFormat,
      uploaded_at: new Date().toISOString(),
    });
    if (sourceFormat === "md") {
      await putHtml(c.env, renderedKey(key), html, {
        draft_id: draft.id,
        version_number: String(versionNumber),
        content_hash: contentHash,
        rendered_from: sourceFormat,
        uploaded_at: new Date().toISOString(),
      });
    }
  }

  // (4) D1 batch: insert the version row AND advance published_version via MAX so
  // out-of-order concurrent finishers cannot move "latest" backward.
  const gitDirty =
    typeof meta.git_dirty === "boolean" ? (meta.git_dirty ? 1 : 0) : null;
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO draft_versions
        (id, draft_id, version_number, object_key, content_hash, file_size, title,
         original_filename, created_by_key_id, idempotency_key, source_ip, cli_version,
         git_branch, git_commit_sha, git_dirty, source_format)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      versionId,
      draft.id,
      versionNumber,
      key,
      contentHash,
      bytes.length,
      title,
      filename,
      auth.keyId ?? null,
      idempotencyKey,
      clientIp(c),
      typeof meta.cli_version === "string" ? meta.cli_version : null,
      typeof meta.git_branch === "string" ? meta.git_branch : null,
      typeof meta.git_commit_sha === "string" ? meta.git_commit_sha : null,
      gitDirty,
      sourceFormat,
    ),
    c.env.DB.prepare(
      `UPDATE drafts
         SET published_version = MAX(COALESCE(published_version, 0), ?),
             current_version_id = CASE WHEN ? >= COALESCE(published_version, 0) THEN ? ELSE current_version_id END,
             title = ?,
             updated_at = datetime('now')
       WHERE id = ?`,
    ).bind(versionNumber, versionNumber, versionId, title, draft.id),
  ]);

  const version = await c.env.DB.prepare("SELECT * FROM draft_versions WHERE id = ?")
    .bind(versionId)
    .first<DraftVersion>();
  return c.json(makeResponse(c.env, draft.id, version!, result.warnings, false, deduped), 201);
});

function makeResponse(
  env: Env,
  draftId: string,
  v: DraftVersion,
  warnings: { code: string; message: string }[],
  idempotentReplay: boolean,
  contentDeduplicated = false,
) {
  const base = env.CONTENT_BASE_URL.replace(/\/$/, "");
  return {
    ok: true,
    draft_id: draftId,
    version_id: v.id,
    version_number: v.version_number,
    content_hash: v.content_hash,
    public_url: `${base}/d/${draftId}`,
    raw_url: `${base}/d/${draftId}/raw`,
    version_url: `${base}/d/${draftId}/v/${v.version_number}`,
    title: v.title,
    warnings,
    source_format: v.source_format ?? "html",
    idempotent_replay: idempotentReplay,
    // True when these exact bytes already existed for this draft, so no new R2 object
    // was written. A new version row is still created.
    content_deduplicated: contentDeduplicated,
  };
}

export default upload;
