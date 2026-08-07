import type { Context } from "hono";

// Uniform JSON error envelope used by every route.
export function jsonError(
  c: Context,
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return c.json({ ok: false, error: { code, message, ...(extra ?? {}) } }, status as never);
}

// Parse a request body that MUST be a JSON object.
//
// `JSON.parse` happily accepts bare `null`, `[]`, `42` and `"str"` — all valid JSON but
// not objects. Reading a field off them yields undefined, or throws for null, which
// surfaces as a 500 on what is really a client error. Every route that reads a JSON
// body must go through this.
//
// Returns either { ok: true, body } or { ok: false, response } — the caller returns the
// response directly so the error envelope stays uniform.
export async function readJsonObject(
  c: Context,
  opts: { allowEmpty?: boolean } = {},
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: Response }
> {
  let parsed: unknown;
  try {
    parsed = await c.req.json();
  } catch {
    // An absent/unparseable body is acceptable for routes where every field is optional.
    if (opts.allowEmpty) return { ok: true, body: {} };
    return { ok: false, response: jsonError(c, 400, "E_BAD_JSON", "Request body must be JSON.") };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      response: jsonError(c, 400, "E_BAD_JSON", "Request body must be a JSON object."),
    };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

// Reject wrong-typed optional string fields rather than silently ignoring them.
// Silently dropping a mistyped draft_id is worse than a 400: the caller believes it
// updated an existing record while a new one was created every time.
export function badStringField(
  c: Context,
  body: Record<string, unknown>,
  fields: readonly string[],
): Response | null {
  for (const f of fields) {
    const v = body[f];
    if (v !== undefined && v !== null && typeof v !== "string") {
      return jsonError(c, 400, "E_BAD_FIELD", `Field '${f}' must be a string.`);
    }
  }
  return null;
}

export function clientIp(c: Context): string | null {
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? null;
}
