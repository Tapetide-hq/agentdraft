import { Hono } from "hono";
import type { Env } from "../env.js";
import { newId, newApiKey } from "../services/id.js";
import { hashApiKey, secretEquals } from "../services/crypto.js";
import { jsonError, readJsonObject, badStringField } from "../lib/http.js";

const bootstrap = new Hono<{ Bindings: Env }>();

// POST /api/bootstrap
// One-time owner + first admin key creation, guarded by the BOOTSTRAP_SECRET.
// Header: X-Bootstrap-Secret: <secret>
// Body: { name, email? }
// Returns the plaintext key ONCE. Refuses if an owner already exists.
bootstrap.post("/", async (c) => {
  const secret = c.env.BOOTSTRAP_SECRET;
  if (!secret) {
    return jsonError(c, 503, "E_BOOTSTRAP_DISABLED", "Bootstrap is not configured.");
  }
  const provided = c.req.header("x-bootstrap-secret") ?? "";
  if (!(await secretEquals(provided, secret))) {
    return jsonError(c, 401, "E_BOOTSTRAP_UNAUTHORIZED", "Invalid bootstrap secret.");
  }

  const existingOwner = await c.env.DB.prepare(
    "SELECT id FROM accounts WHERE is_owner = 1 LIMIT 1",
  ).first<{ id: string }>();
  if (existingOwner) {
    return jsonError(c, 409, "E_ALREADY_BOOTSTRAPPED", "An owner account already exists.");
  }

  const parsedBody = await readJsonObject(c, { allowEmpty: true });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
  const badField = badStringField(c, body, ["name", "email"]);
  if (badField) return badField;
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Owner";
  const email = typeof body.email === "string" ? body.email : null;

  const accountId = newId("acct_");
  const keyId = newId("key_");
  const { full, prefix } = newApiKey();
  const hash = await hashApiKey(full, c.env.API_KEY_PEPPER ?? "");

  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO accounts (id, name, email, is_owner) VALUES (?, ?, ?, 1)",
    ).bind(accountId, name, email),
    c.env.DB.prepare(
      "INSERT INTO api_keys (id, account_id, name, key_prefix, key_hash, scopes) VALUES (?, ?, 'bootstrap', ?, ?, 'upload,read,manage')",
    ).bind(keyId, accountId, prefix, hash),
  ]);

  return c.json(
    {
      ok: true,
      account_id: accountId,
      key_id: keyId,
      api_key: full, // shown ONCE
      scopes: ["upload", "read", "manage"],
      note: "Store this key now. It cannot be retrieved again.",
    },
    201,
  );
});

export default bootstrap;
