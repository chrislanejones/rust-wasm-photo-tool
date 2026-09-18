import { extFromMime } from "@/lib/exportImage";

/**
 * The name a pasted image enters the gallery under — and therefore the stem
 * its export is named from. The gallery strips the extension
 * (`useImageSession`) and export appends `-revised`, so `pasted.png` downloads
 * as `pasted-revised.png` (Chris, 2026-09-15).
 *
 * Only a GENERIC clipboard name is replaced. A screenshot or an image copied
 * out of a web page reaches the paste event as a File the browser has named
 * `image.png` (or with no name at all, or as a bare Blob from
 * `navigator.clipboard.read()`), which used to export as `image-revised.png`.
 * A file copied out of a file manager arrives under its real name, and that
 * name is the user's — `beach.jpg` stays `beach.jpg`.
 *
 * Idempotent: `pasted.png` is not generic, so running a name through twice is
 * harmless. Every paste entry point calls this — AppShell's Ctrl+V over the
 * editor, and the start screen's Paste button and Ctrl+V — so the three cannot
 * drift apart again (they were `pasted.png`, `pasted-image.png` and `image.png`).
 */
const GENERIC_CLIPBOARD_NAME = /^image\.[a-z0-9]+$/i;

export function namePastedImage(source: Blob): File {
  if (
    source instanceof File &&
    source.name &&
    !GENERIC_CLIPBOARD_NAME.test(source.name)
  ) {
    return source;
  }
  const type = source.type || "image/png";
  return new File([source], `pasted${extFromMime(type) || ".png"}`, { type });
}
