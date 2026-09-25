// Display formatting shared by the dashboard routes.

// D1 stores naive UTC timestamps ("2026-09-25 07:47:09"). The trailing "Z" is what makes
// the browser read them as UTC instead of local time, so every route must go through this
// helper rather than calling `new Date(iso)` directly.
export function fmtDate(iso: string): string {
  return new Date(iso + "Z").toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
