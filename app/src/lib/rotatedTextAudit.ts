// Read-only count of stored ROTATED text annotations — the number ADR-050's
// migration decision hangs on.
//
// Chris's rule is "migrate if the count is anything but zero", so this exists
// to produce that one number from a real profile. It is the sibling of
// `contentAudit.ts` and follows its two disciplines exactly:
//
//   1. NEVER open a database by name without checking it exists first.
//      `indexedDB.open("name-that-does-not-exist")` CREATES it. An audit that
//      creates a database has written to the thing it was auditing.
//   2. Read-only transactions only. No put, no delete, no upgrade.
//
// The archive lives in its own raw IndexedDB database (`image-horse-edits` /
// `edits`), NOT in the Dexie `image-horse-dexie` one — see editPersistence.ts.
// Each value is a PersistedEdit keyed by photo id, carrying `annotations` and,
// from archive v5, a `layers` array whose entries carry their own.

const DB_NAME = "image-horse-edits";
const STORE = "edits";

export interface RotatedTextRow {
  photoId: string;
  chars: number;
  rotationDeg: number;
  fontSize: number;
  /** Estimated ink shift in px if the anchor changes — see the caveat below. */
  estShiftPx: number;
}

export interface RotatedTextReport {
  /** Did we find the archive database at all? `false` ⇒ every count is 0
   *  because there was nothing to read, NOT because the answer is zero. */
  dbFound: boolean;
  photosScanned: number;
  textAnnotations: number;
  rotated: number;
  /** Rotated AND estimated to move more than a couple of px. */
  rotatedVisiblyShifting: number;
  rows: RotatedTextRow[];
  notes: string[];
}

/**
 * Estimated ink shift from the centre anchor to the top-left anchor.
 *
 * ⚠️ AN ESTIMATE, and labelled as one everywhere it surfaces. The exact shift
 * is `(hw(cos−1) − hh·sin, hw·sin + hh(cos−1))` where hw/hh are HALF THE TILE
 * dimensions — and the tile is not persisted. `editPersistence.ts` strips
 * `tile_*` on save precisely because it is re-rendered on restore. So the tile
 * is reconstructed here from character count and font size rather than known,
 * and a wrapped or background-padded annotation will be wider than this
 * assumes. Good enough to sort "would anyone notice" from "sub-pixel"; not
 * good enough to migrate with — a migration must ask the engine for the real
 * tile.
 */
function estimateShift(chars: number, fontSize: number, deg: number): number {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // Rough advance width for the embedded faces, plus render_text's 0.25·size
  // padding on each side; height is one line at the 1.3 line factor.
  const tileW = chars * fontSize * 0.5 + fontSize * 0.5;
  const tileH = fontSize * 1.3 + fontSize * 0.5;
  const hw = tileW / 2;
  const hh = tileH / 2;
  const dx = hw * (cos - 1) - hh * sin;
  const dy = hw * sin + hh * (cos - 1);
  return Math.round(Math.hypot(dx, dy));
}

interface MaybeAnnotation {
  text?: unknown;
  rotation_deg?: unknown;
  font_size?: unknown;
}
interface MaybeEdit {
  annotations?: unknown;
  layers?: unknown;
}

function annotationsOf(edit: MaybeEdit): MaybeAnnotation[] {
  const out: MaybeAnnotation[] = [];
  const take = (v: unknown) => {
    if (!Array.isArray(v)) return;
    // Real archives predate several field additions and have been written by
    // builds that are no longer around. A probe that dies on one malformed
    // entry reports nothing about the other two hundred — so junk is skipped,
    // not thrown on. (A `null` in this array crashed the first version.)
    for (const item of v) {
      if (item && typeof item === "object") out.push(item as MaybeAnnotation);
    }
  };
  take(edit.annotations);
  // Archive v5+: every layer carries its own annotation list. Counting only
  // the top-level array would undercount every multi-layer document.
  if (Array.isArray(edit.layers)) {
    for (const layer of edit.layers as { annotations?: unknown }[]) {
      take(layer?.annotations);
    }
  }
  return out;
}

export async function auditRotatedText(): Promise<RotatedTextReport> {
  const notes: string[] = [];
  const empty = (why: string): RotatedTextReport => {
    notes.push(why);
    return {
      dbFound: false,
      photosScanned: 0,
      textAnnotations: 0,
      rotated: 0,
      rotatedVisiblyShifting: 0,
      rows: [],
      notes,
    };
  };

  if (typeof indexedDB === "undefined") {
    return empty("No indexedDB in this context.");
  }
  if (typeof indexedDB.databases !== "function") {
    return empty(
      "indexedDB.databases() is unavailable here, so no database was opened — " +
        "opening a name that does not exist would CREATE it, and an audit must " +
        "not write. Run this in a Chromium-based browser.",
    );
  }

  const names = (await indexedDB.databases())
    .map((d) => d.name)
    .filter((n): n is string => typeof n === "string");
  if (!names.includes(DB_NAME)) {
    return empty(
      `No "${DB_NAME}" database on this origin. Nothing was opened. If you expected ` +
        `edits here, check you are on the origin you actually edit on — a count of ` +
        `zero from the wrong origin looks identical to a real zero.`,
    );
  }

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    // No version argument: passing one can trigger an upgrade, which writes.
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => reject(new Error("audit refused to upgrade the database"));
  });

  try {
    if (!db.objectStoreNames.contains(STORE)) {
      return empty(`"${DB_NAME}" exists but has no "${STORE}" store.`);
    }
    const entries = await new Promise<[string, MaybeEdit][]>((resolve, reject) => {
      const out: [string, MaybeEdit][] = [];
      const tx = db.transaction(STORE, "readonly");
      const cur = tx.objectStore(STORE).openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return resolve(out);
        out.push([String(c.key), c.value as MaybeEdit]);
        c.continue();
      };
      cur.onerror = () => reject(cur.error);
    });

    const rows: RotatedTextRow[] = [];
    let textAnnotations = 0;
    for (const [photoId, edit] of entries) {
      for (const a of annotationsOf(edit)) {
        textAnnotations += 1;
        const deg = typeof a.rotation_deg === "number" ? a.rotation_deg : 0;
        // The engine's own threshold: |deg| < 0.5 takes the no-rotation early
        // return in build_annotation_tile, so it is not rotated in any sense
        // that matters here.
        if (Math.abs(deg) < 0.5) continue;
        const chars = typeof a.text === "string" ? a.text.length : 0;
        const fontSize = typeof a.font_size === "number" ? a.font_size : 24;
        rows.push({
          photoId,
          chars,
          rotationDeg: deg,
          fontSize,
          estShiftPx: estimateShift(chars, fontSize, deg),
        });
      }
    }
    rows.sort((x, y) => y.estShiftPx - x.estShiftPx);
    return {
      dbFound: true,
      photosScanned: entries.length,
      textAnnotations,
      rotated: rows.length,
      rotatedVisiblyShifting: rows.filter((r) => r.estShiftPx > 2).length,
      rows,
      notes,
    };
  } finally {
    db.close();
  }
}

export function formatRotatedTextMarkdown(r: RotatedTextReport): string {
  const lines: string[] = ["## Rotated text audit (ADR-050)", ""];
  if (!r.dbFound) {
    lines.push("**No archive database read.**", "");
    for (const n of r.notes) lines.push(`- ${n}`);
    lines.push("", "⚠️ This is NOT a count of zero. Nothing was read.");
    return lines.join("\n");
  }
  lines.push(
    "| Metric | Count |",
    "|---|---|",
    `| Photos with a stored archive | ${r.photosScanned} |`,
    `| Text annotations | ${r.textAnnotations} |`,
    `| **Rotated (\\|deg\\| >= 0.5)** | **${r.rotated}** |`,
    `| Rotated, est. shift > 2px | ${r.rotatedVisiblyShifting} |`,
    "",
    r.rotated === 0
      ? "**Migration not needed** — nothing stored is rotated, so changing the anchor moves nothing."
      : "**Migration needed** — Chris's rule is any non-zero count.",
    "",
  );
  if (r.rows.length) {
    lines.push(
      "Largest estimated shifts (⚠️ ESTIMATES — the tile is not persisted, so",
      "width is reconstructed from character count; wrapped or padded",
      "annotations are wider than this assumes):",
      "",
      "| photo | chars | deg | font | est shift px |",
      "|---|---|---|---|---|",
    );
    for (const row of r.rows.slice(0, 15)) {
      lines.push(
        `| ${row.photoId.slice(0, 12)} | ${row.chars} | ${row.rotationDeg} | ${row.fontSize} | ${row.estShiftPx} |`,
      );
    }
  }
  for (const n of r.notes) lines.push(`- ${n}`);
  return lines.join("\n");
}
