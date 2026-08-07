// Server-side API client for the dashboard BFF. Runs only in the Worker; uses the
// key from locals (never exposed to the browser).
//
// It talks to the API worker via a SERVICE BINDING (env.API) when available — a
// Worker cannot fetch a sibling Worker on the same account through its public
// *.workers.dev URL (loopback, CF error 1042). The binding's .fetch() takes a normal
// Request with an absolute URL; the origin is ignored (the binding routes it).

interface ApiService {
  fetch(input: Request): Promise<Response>;
}

export interface ApiCtx {
  apiBase: string;
  apiKey: string | null;
  service?: ApiService | null;
}

export async function apiFetch(
  ctx: ApiCtx,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (ctx.apiKey) headers.set("Authorization", `Bearer ${ctx.apiKey}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const url = `${ctx.apiBase}${path}`;
  if (ctx.service) {
    const req = new Request(url, { ...init, headers });
    return ctx.service.fetch(req);
  }
  return fetch(url, { ...init, headers });
}

export async function apiJson<T>(ctx: ApiCtx, path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(ctx, path, init);
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `API ${res.status}`);
  }
  return data;
}
