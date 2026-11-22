// Batch › Strip info (Night 11-21, 231, ADR-108): apply a camera-info choice
// to every photo's STORED copy, so every later export, phone Save and
// computer-to-phone pairing send carries the stripped file.
//
// Lossless: this is a metadata scrub of the stored bytes (lib/exif), never a
// decode or re-encode, so the pixels do not change. A turned JPEG under
// "Remove all" keeps only its Orientation tag, so it is not stored sideways.
//
// BOTH keys are rewritten. `uploadKey` is the photo's "immutable" upload
// original, the Compare baseline and the source every Keep-all export reads
// EXIF from. Leaving it alone would let a later Keep-all export put the
// location straight back, which is the one thing this tool promises cannot
// happen. Its PIXELS are untouched, so it is still the same baseline; only
// its metadata is gone. ADR-108 records the exception to "never replaced".
import { cameraInfoForVerbatim } from "@/lib/exif/cameraInfo";

export type StripChoice = "location" | "all" | "keep";

export const STRIP_CHOICES: readonly { id: StripChoice; label: string }[] = [
  { id: "location", label: "Remove location" },
  { id: "all", label: "Remove all" },
  { id: "keep", label: "Leave as is" },
];

interface StoredFile {
  bytes: ArrayBuffer;
  mimeType: string;
  name: string;
  width: number;
  height: number;
}

export interface StripDeps {
  getOriginal(key: string): Promise<StoredFile | null>;
  /** Content-addressed: returns the key of the bytes written. */
  putOriginal(file: File, width: number, height: number): Promise<string>;
}

export interface StripPhoto {
  id: string;
  name: string;
  mimeType: string;
  originalKey: string;
  uploadKey?: string;
}

export type StripResult =
  | { status: "stripped"; patch: { originalKey: string; uploadKey?: string; byteSize: number }; replaced: Array<[string, string]> }
  | { status: "clean" | "skipped" | "failed"; note: string };

const SCRUBBABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Scrub one stored key. Null when there was nothing to remove. */
async function scrubKey(key: string, choice: Exclude<StripChoice, "keep">, deps: StripDeps) {
  const f = await deps.getOriginal(key);
  if (!f) throw new Error("couldn't read the stored file");
  if (!SCRUBBABLE.has(f.mimeType)) return { kind: "unsupported" as const, mime: f.mimeType };
  const before = new Uint8Array(f.bytes);
  const after = cameraInfoForVerbatim(before, f.mimeType, choice);
  if (sameBytes(before, after)) return { kind: "clean" as const, size: before.length };
  const newKey = await deps.putOriginal(new File([after], f.name, { type: f.mimeType }), f.width, f.height);
  return { kind: "written" as const, key: newKey, size: after.length };
}

export async function stripStoredCopy(photo: StripPhoto, choice: StripChoice, deps: StripDeps): Promise<StripResult> {
  if (choice === "keep") return { status: "skipped", note: "left as is" };
  if (photo.mimeType === "image/svg+xml") return { status: "skipped", note: "SVG — no camera info" };
  try {
    const orig = await scrubKey(photo.originalKey, choice, deps);
    if (orig.kind === "unsupported") {
      return { status: "skipped", note: `${orig.mime.replace("image/", "").toUpperCase()} — can't read its camera info yet` };
    }
    const upKey = photo.uploadKey && photo.uploadKey !== photo.originalKey ? photo.uploadKey : null;
    const up = upKey ? await scrubKey(upKey, choice, deps) : null;
    const replaced: Array<[string, string]> = [];
    const patch: { originalKey: string; uploadKey?: string; byteSize: number } = {
      originalKey: photo.originalKey,
      byteSize: orig.size,
    };
    if (orig.kind === "written") {
      patch.originalKey = orig.key;
      replaced.push([photo.originalKey, orig.key]);
    }
    if (upKey && up?.kind === "written") {
      patch.uploadKey = up.key;
      replaced.push([upKey, up.key]);
    } else if (!upKey && photo.uploadKey && orig.kind === "written") {
      // A fresh import: one blob is both keys, so both move together.
      patch.uploadKey = orig.key;
    }
    if (replaced.length === 0) return { status: "clean", note: "nothing to remove" };
    return { status: "stripped", patch, replaced };
  } catch (err) {
    return { status: "failed", note: err instanceof Error ? err.message : "failed" };
  }
}

/** "This removes location from 12 photos. It can't be undone." */
export function confirmText(counts: { location: number; all: number }): string {
  const parts: string[] = [];
  if (counts.location > 0) parts.push(`location from ${counts.location} photo${counts.location === 1 ? "" : "s"}`);
  if (counts.all > 0) parts.push(`all camera info from ${counts.all} photo${counts.all === 1 ? "" : "s"}`);
  return `This removes ${parts.join(" and ")}. It can't be undone.`;
}
