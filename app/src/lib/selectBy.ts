// Gallery › Select ▾ (Night 10-28, 233): tick photos by a rule instead of one
// at a time. Pure, so the menu stays a thin view and the rules are testable.
//
// The ticks ARE Batch's Exceptions (ADR-079), so "Select ▾ Portrait" followed
// by Batch gives the portraits their own settings.
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

export type SelectRule =
  | { kind: "portrait" }
  | { kind: "landscape" }
  | { kind: "square" }
  | { kind: "larger"; bytes: number }
  | { kind: "edited" }
  | { kind: "unedited" }
  | { kind: "invert" };

/** The photo's size as stored now — the size a resize or crop left it at. */
function dims(p: PhotoEntry): { w: number; h: number } {
  return { w: p.origWidth || p.workingWidth, h: p.origHeight || p.workingHeight };
}

/** Within 1% counts as square: a phone "square" crop is often 1080×1081. */
const SQUARE_TOLERANCE = 0.01;

export function matchesRule(p: PhotoEntry, rule: SelectRule, edited: ReadonlySet<string>): boolean {
  const { w, h } = dims(p);
  const square = w > 0 && h > 0 && Math.abs(w - h) <= Math.max(w, h) * SQUARE_TOLERANCE;
  switch (rule.kind) {
    case "portrait":
      return !square && h > w;
    case "landscape":
      return !square && w > h;
    case "square":
      return square;
    case "larger":
      return p.byteSize > rule.bytes;
    case "edited":
      return edited.has(p.id);
    case "unedited":
      return !edited.has(p.id);
    case "invert":
      return false; // handled in `applyRule`, it needs the current ticks
  }
}

/**
 * The ticks after a rule. Without `add` the rule REPLACES the ticks; with it
 * (Shift) the matches join the current ones. Invert ignores `add`: it is the
 * complement of what is ticked now.
 */
export function applyRule(
  photos: readonly PhotoEntry[],
  current: ReadonlySet<string>,
  rule: SelectRule,
  edited: ReadonlySet<string>,
  add: boolean,
): Set<string> {
  if (rule.kind === "invert") return new Set(photos.filter((p) => !current.has(p.id)).map((p) => p.id));
  const next = new Set(add ? current : []);
  for (const p of photos) if (matchesRule(p, rule, edited)) next.add(p.id);
  return next;
}

/** "1.5 MB" / "300 KB" → bytes; a bare number is KB. Null when unreadable. */
export function parseSize(text: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(kb|k|mb|m|b)?\s*$/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? "kb").toLowerCase();
  const bytes = unit.startsWith("m") ? n * 1024 * 1024 : unit === "b" ? n : n * 1024;
  return Number.isFinite(bytes) && bytes >= 0 ? Math.round(bytes) : null;
}
