// Beta: HEIC import (`ih_heic_import`, ADR-087).
//
// OFF — the default, and everyone who has not opted in — is the old behavior
// exactly. A .heic is not recognized here at all: the import filters see only
// what they always saw (`type` starts with "image/", or an SVG), and a HEIC
// that gets past them anyway dies in `createImageBitmap` with the usual toast.
// libheif is never fetched.
//
// ON, a .heic/.heif/.hif is converted at the door, like an SVG: decoded by
// libheif in the codec worker, re-encoded to WebP with its EXIF carried over
// (lib/heic.ts), and from then on it is an ordinary photo.
//
// THIS MODULE IS IN THE MAIN BUNDLE, SO IT IS SMALL ON PURPOSE. It answers
// "is it on?" and "is this file a HEIC by its label?", and nothing more. The
// converter (lib/heic.ts, the EXIF box walk, the worker call) is a dynamic
// import behind `convertHeicImport`, and libheif itself is a second dynamic
// import inside the worker — so neither touches the first load.

/** The registry row's own predicate — see `featureFlags.ts`. */
export function isHeicImportEnabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem("ih_heic_import") === "1";
  } catch {
    return false;
  }
}

/**
 * True if the file is (or claims to be) HEIC/HEIF — mime or extension.
 *
 * The extension half is not belt-and-braces: Chrome and Firefox on Windows and
 * Linux hand over `type: ""` for a .heic because the OS has no mime mapping
 * for a format those browsers can't display, so an `f.type.startsWith("image/")`
 * filter drops iPhone photos on the floor without a word.
 */
export function isHeicFile(file: File): boolean {
  return /^image\/hei[cf](-sequence)?$/i.test(file.type) || /\.(heic|heif|hif)$/i.test(file.name);
}

/** True when the Beta is on AND the file is a HEIC by its label. With the Beta
 *  off this is always false, which is what keeps every funnel at master's
 *  behavior. */
export function isHeicImport(file: File): boolean {
  return isHeicImportEnabled() && isHeicFile(file);
}

/** What a file picker adds to its `accept` list while the Beta is on. */
export const HEIC_ACCEPT = ".heic,.heif,.hif";

/** Thrown when a file really is a HEIC and we still could not open it. Carries
 *  a message meant for a toast — the import funnels surface it verbatim. Lives
 *  here, not in lib/heic.ts, so `instanceof` in the main bundle does not pull
 *  the converter in with it. */
export class HeicDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HeicDecodeError";
  }
}

/** Convert a HEIC to a WebP `File`, loading the converter on first use. A file
 *  that only looks like a HEIC by name comes back untouched. */
export async function convertHeicImport(file: File): Promise<File> {
  const { convertHeicToWebp } = await import("@/lib/heic");
  return convertHeicToWebp(file);
}
