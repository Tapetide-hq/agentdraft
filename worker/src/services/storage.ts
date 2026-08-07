import type { Env } from "../env.js";

export function objectKey(draftId: string, versionId: string): string {
  return `drafts/${draftId}/${versionId}.html`;
}

export async function putHtml(
  env: Env,
  key: string,
  html: string,
  meta: Record<string, string>,
): Promise<void> {
  await env.STORAGE.put(key, html, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
    customMetadata: meta,
  });
}

export async function getHtml(env: Env, key: string): Promise<R2ObjectBody | null> {
  return env.STORAGE.get(key);
}
