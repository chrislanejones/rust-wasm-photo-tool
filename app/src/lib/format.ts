// app/src/lib/format.ts
// Small shared formatting helpers.

/** Format a byte count as a compact human-readable size (e.g. "80 KB"). */
export function formatBytes(n?: number | null): string | null {
  if (n == null || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
