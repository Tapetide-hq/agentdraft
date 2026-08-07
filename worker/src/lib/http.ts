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

export function clientIp(c: Context): string | null {
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? null;
}
