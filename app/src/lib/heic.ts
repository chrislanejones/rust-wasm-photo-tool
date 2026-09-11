// ===== FILE: app/src/lib/heic.ts =====
/**
 * HEIC/HEIF import support: re-encode to WebP at the import boundary.
 *
 * Same shape as lib/rasterizeSvg.ts, for the same reason — `createImageBitmap`
 * cannot decode a HEIC in any browser except Safari, so an un-converted HEIC
 * dies with "Couldn't read image". Every import funnel (`handleAddPhotos`,
 * `openImportDialog`, the batch logo picker) converts first, and only the
 * converted pixels enter the pipeline, including the gallery "original" stored
 * in IndexedDB. Nothing downstream ever sees a .heic.
 *
 * WHY WEBP AND NOT PNG. The converted file IS the stored original: it is what
 * a verbatim export hands back and what every re-open decodes. A 12 MP iPhone
 * photo is ~2 MB as HEIC, ~2.5 MB as WebP at the quality below, and ~35 MB as
 * PNG — storing PNG would blow through the browser's storage quota after a
 * couple of dozen photos to preserve detail that a lossy HEIC never had.
 *
 * WHY NOT KEEP THE .heic BYTES. Then every open would re-run a ~1 s WASM
 * decode, and a verbatim export would hand back a file most of the user's
 * other software still cannot open. Converting once, at the door, is the whole
 * point of the feature.
 *
 * EXIF SURVIVES. Re-encoded pixels carry no metadata, so the camera/lens/time
 * block is read out of the HEIC container (lib/heicExif.ts) and transplanted
 * into the WebP — the Image Meta panel and the Security pane's GPS scrub work
 * on an imported iPhone photo exactly as they do on a JPEG.
 */

import { applyExifToReencoded } from "@/lib/exif";
import { extractHeicExifTiff } from "@/lib/heicExif";
import { heicToWebpViaWorker } from "@/lib/codecWorkerClient";
import { assertWithinPixelBudget } from "@/lib/workingCopy";

/** Quality for the boundary re-encode. High enough to be a non-event next to
 *  the lossy HEIC it came from; low enough that the stored original stays in
 *  the same size class as the file the user picked. */
const WEBP_QUALITY = 0.92;

/** Thrown when a file really is a HEIC and we still could not open it. Carries
 *  a message meant for a toast — the import funnels surface it verbatim. */
export class HeicDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HeicDecodeError";
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

/** ISO-BMFF brands that mean "a HEIF still image". `mif1`/`msf1`/`miaf` are
 *  the generic MIAF brands HEIC files from some writers lead with. */
const HEIF_BRANDS = new Set([
  "heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs",
  "mif1", "mif2", "msf1", "miaf", "mia1",
]);

/** AVIF is also ISO-BMFF and also lists `mif1`, but every browser decodes it
 *  natively — routing it through libheif would be slower and pointless. */
const AVIF_BRANDS = new Set(["avif", "avis", "avio"]);

/**
 * Sniff the `ftyp` box: `size(4) "ftyp" major_brand(4) minor_version(4)` then a
 * list of compatible brands. Extensions lie; this is what actually decides
 * whether we hand the bytes to libheif.
 *
 * EVERY brand is read before answering, major and compatible alike, and an
 * AVIF brand anywhere is a veto. Answering "yes" the moment a HEIF brand turns
 * up would misfile the common AVIF header `major=mif1, compatible=[mif1,avif]`
 * — `mif1` is a generic MIAF brand that both formats lead with.
 */
export function looksLikeHeicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) !== "ftyp") return false;

  const brandAt = (off: number) =>
    String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]).toLowerCase();

  // Major brand at 8, minor_version at 12, compatible brands from 16 to the
  // end of the ftyp box.
  const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  const end = Math.min(boxSize > 0 ? boxSize : bytes.length, bytes.length);
  const brands = [brandAt(8)];
  for (let off = 16; off + 4 <= end; off += 4) brands.push(brandAt(off));

  if (brands.some((brand) => AVIF_BRANDS.has(brand))) return false;
  return brands.some((brand) => HEIF_BRANDS.has(brand));
}

/** Swap a .heic/.heif/.hif extension for .webp, keeping the basename. */
function toWebpName(name: string): string {
  const base = name.replace(/\.(heic|heif|hif)$/i, "");
  return `${base || "image"}.webp`;
}

/**
 * Safari (macOS/iOS) decodes HEIC natively, so try the browser first: it skips
 * the ~2 MB libheif download entirely and uses the platform's hardware decoder.
 * Returns null when the browser can't read it — which is every other browser
 * today, and a one-off rejected promise to find that out.
 */
async function reencodeNatively(
  file: File,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  // Past this point a failure is ours, not "the browser can't read HEIC", so
  // it throws rather than falling through to a second decode attempt.
  assertWithinPixelBudget(bitmap); // closes the bitmap if it throws
  const { width, height } = bitmap;
  try {
    const oc = new OffscreenCanvas(width, height);
    oc.getContext("2d")!.drawImage(bitmap, 0, 0);
    const blob = await oc.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY });
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}

/**
 * Convert a HEIC/HEIF `File` to a WebP `File` (same basename, `.webp`), with
 * the source EXIF transplanted in when the container carried any.
 *
 * A file that only *looks* like a HEIC by name is returned untouched — a
 * mislabelled JPEG decodes perfectly well through the normal path, and
 * refusing it would be a regression invented by this feature.
 *
 * Throws `HeicDecodeError` (message meant for a toast) or `ImageTooLargeError`.
 */
export async function convertHeicToWebp(file: File): Promise<File> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeHeicBytes(bytes)) return file;

  // Read EXIF before the decode: the worker path TRANSFERS these bytes away.
  const tiff = extractHeicExifTiff(bytes);

  let encoded = await reencodeNatively(file);
  if (!encoded) {
    let viaWorker: Awaited<ReturnType<typeof heicToWebpViaWorker>>;
    try {
      viaWorker = await heicToWebpViaWorker(bytes, WEBP_QUALITY);
    } catch (err) {
      // A Comlink round trip flattens error subclasses, so whatever the
      // decoder refused for arrives as a plain message — including the shared
      // "Image is too large to open (…)" one. Every import funnel shows a
      // HeicDecodeError's message verbatim, so it reads the same either way.
      throw new HeicDecodeError(err instanceof Error ? err.message : String(err));
    }
    if (!viaWorker) {
      throw new HeicDecodeError(
        "HEIC files are decoded in a Web Worker, and this browser wouldn't start one.",
      );
    }
    encoded = viaWorker;
  }

  if (!tiff) return new File([encoded.blob], toWebpName(file.name), { type: "image/webp" });
  const withExif = applyExifToReencoded(
    new Uint8Array(await encoded.blob.arrayBuffer()),
    "webp",
    "keep",
    tiff,
    encoded.width,
    encoded.height,
  );
  return new File([withExif], toWebpName(file.name), { type: "image/webp" });
}
