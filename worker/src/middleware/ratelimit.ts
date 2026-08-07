import type { Context, Next } from "hono";
import type { Env } from "../env.js";
import type { AuthContext } from "../types.js";
import { jsonError, clientIp } from "../lib/http.js";

// Fixed-window rate limiting backed by KV counters. No Durable Objects (free tier).
// A fixed window is coarse (allows up to 2x at a boundary) but is correct enough for
// abuse prevention and costs one KV read + one KV write per request.
//
// bucket: a label ("upload","read"); limit: max requests; windowSec: window length.
export function rateLimit(bucket: string, limit: number, windowSec: number) {
  return async (
    c: Context<{ Bindings: Env; Variables: { auth?: AuthContext } }>,
    next: Next,
  ) => {
    const auth = c.get("auth");
    // Prefer keying on the API key id (stable) else the account, else the client IP.
    const principal = auth?.keyId ?? auth?.account?.id ?? clientIp(c) ?? "anon";
    const windowId = Math.floor(Date.now() / 1000 / windowSec);
    const key = `rl:${bucket}:${principal}:${windowId}`;

    const current = parseInt((await c.env.RATELIMIT.get(key)) ?? "0", 10);
    if (current >= limit) {
      c.header("Retry-After", String(windowSec));
      return jsonError(
        c,
        429,
        "E_RATE_LIMITED",
        `Rate limit exceeded: ${limit} ${bucket} requests per ${windowSec}s.`,
      );
    }
    // Increment. TTL a little beyond the window so stale counters expire.
    c.executionCtx.waitUntil(
      c.env.RATELIMIT.put(key, String(current + 1), { expirationTtl: windowSec + 60 }),
    );
    await next();
  };
}
