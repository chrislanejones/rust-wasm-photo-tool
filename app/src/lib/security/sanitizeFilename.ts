// Filename sanitizer — never trust an uploaded/derived filename when writing it
// into a ZIP entry or a download `download=` attribute. Strips path traversal
// (`../`, `..\`, absolute roots), path separators, control chars, and reserved
// names; collapses to a safe, bounded basename. See docs/Security-Hardening.md.

/** Reserved device names on Windows (case-insensitive, with or without ext). */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

/**
 * Return a safe basename for `name`, falling back to `fallback` if nothing
 * usable remains. Never returns a path — only a single segment.
 */
export function sanitizeFilename(name: string, fallback = "image"): string {
  // Take the last path segment (defeats ../../ and absolute paths).
  let base = String(name)
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .trim();

  // Drop control chars and characters illegal across filesystems.
  // eslint-disable-next-line no-control-regex
  base = base.replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, "_");

  // No leading dots (hidden files / traversal remnants) and collapse runs.
  base = base.replace(/^\.+/, "").replace(/_{2,}/g, "_").trim();

  if (!base || RESERVED.test(base)) base = fallback;

  // Bound the length, preserving the extension.
  if (base.length > 200) {
    const dot = base.lastIndexOf(".");
    const ext = dot > 0 ? base.slice(dot) : "";
    base = base.slice(0, 200 - ext.length) + ext;
  }
  return base;
}
