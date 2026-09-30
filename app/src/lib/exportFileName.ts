/**
 * The single-image Download's file name — the stem only; the extension is
 * always chosen from the encoded bytes (`extFromMime(blob.type)`), never typed.
 *
 * The default is the gallery name with `-revised` appended, so `beach.jpg`
 * downloads as `beach-revised.jpg` unless the user renames it in the export
 * dialog.
 */
export function defaultExportStem(photoName: string | undefined): string {
  return `${stripExt(photoName || "image")}-revised`;
}

/** Image extensions a user is likely to type into the name field out of habit.
 *  Stripped so `bob.jpeg` does not download as `bob.jpeg.jpg`. */
const TYPED_IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif|svg|bmp|tiff?|heic)$/i;

/** Characters no desktop filesystem accepts (Windows is the strictest), plus
 *  control characters. The browser sanitizes `a.download` too, but it does so
 *  by substituting `_` or dropping the name entirely, depending on the
 *  browser — cleaning it here keeps the result predictable. */
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;

/**
 * Clean a user-typed name into a safe stem. Returns `null` when nothing usable
 * is left, so the caller falls back to the default rather than downloading a
 * file named `.jpg`.
 */
export function sanitizeExportStem(input: string): string | null {
  const stem = input
    .replace(ILLEGAL, "")
    .trim()
    .replace(TYPED_IMAGE_EXT, "")
    // Leading dots hide the file on macOS/Linux; trailing dots and spaces are
    // silently dropped by Windows.
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 200);
  return stem || null;
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
