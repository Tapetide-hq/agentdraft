import type { Env } from "../env.js";

export function objectKey(draftId: string, versionId: string): string {
  return `drafts/${draftId}/${versionId}.html`;
}

// Companion key holding the RENDERED html for a Markdown upload. The source object
// keeps the canonical key (so /raw and dedup logic are unchanged) and the rendered
// document lives alongside it. Rendering is done once at upload, never per request, so
// a future `marked` upgrade cannot silently alter an already-published document.
export function renderedKey(sourceKey: string): string {
  return sourceKey.replace(/\.html$/, "") + ".rendered.html";
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
