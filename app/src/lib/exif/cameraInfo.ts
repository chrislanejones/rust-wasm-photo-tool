// app/src/lib/exif/cameraInfo.ts — "Camera info: Keep all · Remove location ·
// Remove all", the one export choice (Night 11-21, 231, ADR-108).
//
// The choice is stored in the two preferences that already existed
// (`exifKeep`, `exifStripMode`, Settings › Security), so it is remembered and
// syncs like every other preference without a new field or a prefs-format
// bump. This file is the single mapping between the three-way choice and those
// two fields, and the single place each export path asks what to do.
//
//   keep      → exifKeep true                          (date, camera, GPS…)
//   location  → exifKeep false, exifStripMode location (date, camera; no GPS)
//   all       → exifKeep false, exifStripMode all      (nothing but, for a
//               turned verbatim JPEG, the Orientation tag; see orientation.ts)
//
// The DEFAULT is unchanged tonight: exifKeep false + "all" = Remove all, which
// is what every export already did for anyone who never opened Security.
import type { ExportFormat } from "@/lib/exportImage";
import type { Bytes, ExifMode } from "./codecs";
import { applyExifToReencoded, applyExifToVerbatim, prepareExifTiff } from "./index";
import type { MetadataStripMode } from "./index";

export type CameraInfo = "keep" | "location" | "all";

export const CAMERA_INFO_LABEL: Record<CameraInfo, string> = {
  keep: "Keep all",
  location: "Remove location",
  all: "Remove all",
};

interface ExifPrefs {
  exifKeep: boolean;
  exifStripMode: MetadataStripMode;
}

export function cameraInfoOf(p: ExifPrefs): CameraInfo {
  if (p.exifKeep) return "keep";
  return p.exifStripMode === "location" ? "location" : "all";
}

/** `prevStripMode` is kept under Keep all, where it does nothing, so switching
 *  Keep → Remove … → Keep never rewrites a field the person did not touch. */
export function prefsForCameraInfo(c: CameraInfo, prevStripMode: MetadataStripMode = "all"): ExifPrefs {
  if (c === "keep") return { exifKeep: true, exifStripMode: prevStripMode };
  return { exifKeep: false, exifStripMode: c === "location" ? "location" : "all" };
}

/** The verbatim-path pair a choice maps to. */
function verbatimModes(c: CameraInfo): { mode: ExifMode; stripMode: MetadataStripMode } {
  return { mode: c === "keep" ? "keep" : "strip", stripMode: c === "location" ? "location" : "all" };
}

/** Does a re-encoded export under this choice carry a source TIFF at all? */
export function carriesSourceTiff(c: CameraInfo, format: ExportFormat): boolean {
  return c !== "all" && (format === "jpeg" || format === "webp");
}

/**
 * A RE-ENCODED export (pixels already upright). Keep transplants the source
 * TIFF with Orientation set to 1; Remove location transplants it with the GPS
 * IFD scrubbed too; Remove all writes none.
 */
export function cameraInfoForReencoded(
  encoded: Bytes,
  format: ExportFormat,
  choice: CameraInfo,
  sourceTiff: Bytes | null,
  width: number,
  height: number,
): Bytes {
  if (choice === "all" || !sourceTiff) return applyExifToReencoded(encoded, format, "strip", null, width, height);
  const tiff = prepareExifTiff(sourceTiff, choice === "location" ? "location" : "keep");
  return applyExifToReencoded(encoded, format, "keep", tiff, width, height);
}

/** A VERBATIM export or stored copy (the file's own bytes, never decoded). */
export function cameraInfoForVerbatim(bytes: Bytes, mime: string, choice: CameraInfo): Bytes {
  const { mode, stripMode } = verbatimModes(choice);
  return applyExifToVerbatim(bytes, mime, mode, stripMode);
}
