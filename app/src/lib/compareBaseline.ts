// Which stored blob is the A/B compare baseline for a photo.
//
// `contentAudit.ts` names it: "PhotoEntry.uploadKey? — the immutable upload
// original (A/B baseline)". The distinction matters because `originalKey` is
// NOT immutable — Auto Compress repoints it at the compressed file and deletes
// the blob it replaced. `uploadKey` is left alone, which is what keeps a
// comparison meaningful after a compress.
//
// `originalKey` is the fallback for photos that predate `uploadKey`. For those,
// an Auto Compress does move the baseline, and compare then shows two identical
// images — a true answer about a legacy photo, not a broken button.
//
// Extracted because the same expression sat inline in three places (AppShell's
// compare effect, useCanvasActions, useUploadDimensions) and the CONCEPT — "the
// thing to compare against" — had no name, which is how the compare button
// ended up gated on transient modification flags instead of on this.

/** The minimal shape this needs; `PhotoEntry` satisfies it. */
export interface HasBaselineKeys {
  uploadKey?: string;
  originalKey?: string;
}

/** The immutable A/B baseline key, or `null` when the photo has neither. */
export function compareBaselineKey(entry: HasBaselineKeys | null | undefined): string | null {
  return entry?.uploadKey ?? entry?.originalKey ?? null;
}
