// App-wide user preferences (Settings → General/Appearance). Persisted to
// localStorage immediately, and replicated from there by the sync layer —
// instantly to every other tab, and (when signed in) to every other device as
// the `prefs` document. See lib/sync/ and docs/adr/061.
//
// THIS MODULE DOES NOT TALK TO CONVEX. It used to: it held its own pull/push
// against `users.settings` with a SHA-256 to skip redundant writes. That code
// moved to lib/sync/ wholesale, because the same three problems (a canonical
// serialization, a validator for a blob written by another build, and a rule
// for who wins) had to be solved again for every other piece of state that
// should follow a user between devices. What is left here is the part that is
// actually about preferences: the shape, the defaults, and the clamps.
//
// The seam is at the bottom: `readPreferences` / `adoptPreferences` /
// `parsePreferences` / `subscribePreferences`, which lib/sync/docs.ts wires
// into a synced document. The dependency runs ONE WAY — sync imports
// preferences, never the reverse — so this module stays importable by anything
// (including the marketing prerender) without dragging a Convex client in.
import { useCallback, useSyncExternalStore } from "react";
import type { MetadataStripMode } from "@/lib/exif";

export type ThemeChoice = "system" | "dark" | "light";

/** Canvas grid layout: uniform px squares, golden-ratio lines, or N×M divisions. */
export type GridKind = "square" | "golden" | "grid";

/** Ruler tick units. Pixels are the document's own unit; inches and
 *  centimeters are derived at a FIXED 96 DPI — the CSS reference pixel — because
 *  a web image carries no inherent physical size. That makes "1 inch" a
 *  consistent 96px here rather than a promise about print output. */
export type RulerUnit = "px" | "in" | "cm";
const RULER_UNITS: readonly RulerUnit[] = ["px", "in", "cm"] as const;

/** CSS reference pixels per inch. Fixed on purpose — see `RulerUnit`. */
export const RULER_DPI = 96;

export interface Preferences {
  /** Undo-history depth applied to the WASM engine (50–1000). */
  maxHistory: number;
  /** Minutes of inactivity before the idle screen; 0 = never. */
  idleTimeoutMin: number;
  /** Appearance theme (light / dark / system). */
  theme: ThemeChoice;
  // ── Rulers & Grids (canvas overlays; non-destructive) ──────────────────────
  /** Show top + left rulers along the canvas. */
  rulers: boolean;
  /** Unit the ruler tick labels are drawn in. */
  rulerUnit: RulerUnit;
  /** Show the grid overlay. */
  grid: boolean;
  /** Which grid layout to draw. */
  gridKind: GridKind;
  /** Square-grid spacing in image px. */
  gridSpacing: number;
  /** Columns for the N×M grid. */
  gridCols: number;
  /** Rows for the N×M grid. */
  gridRows: number;
  /** Grid line color (hex). */
  gridColor: string;
  /** Grid line opacity, 0–100. */
  gridOpacity: number;
  /** Reopen the previous session's gallery on launch. Signed-in users control
   *  this here; anonymous users get the Resume prompt instead. */
  reopenLastSession: boolean;
  /** Minimize UI animation (panel slides, fades, transitions) for a calmer,
   *  faster interface — accessibility / motion-sensitivity. */
  reduceMotion: boolean;
  /** Keep camera metadata (EXIF — GPS, capture time, lens) on JPEG/WebP export,
   *  or strip it for privacy. Applies to all export paths. */
  exifKeep: boolean;
  /** When `exifKeep` is false, how aggressively to scrub a *verbatim* original
   *  on export (re-encoded/canvas exports are already clean either way — see
   *  `applyExifToReencoded`): 'all' drops EXIF/GPS/maker-notes/XMP/IPTC (ICC
   *  kept — see the DECISION note in lib/exif.ts), 'location' removes only
   *  GPS and leaves camera/lens/timestamp intact. Defaults to 'all' so this
   *  new choice never silently changes existing export behavior. */
  exifStripMode: MetadataStripMode;
  /** When a freshly-imported photo loads, place it on a slightly larger backing
   *  canvas as TWO layers — a "Background" canvas + the "Photo" on top —
   *  Photoshop-style. Off ⇒ the classic single full-bleed "Background" layer at
   *  the exact photo size. Applies to new imports only ("at least initially"). */
  canvasArtboard: boolean;
  /** Border (in image px) added on every side when `canvasArtboard` is on, i.e.
   *  the document is `photo + 2 × canvasPadding`. */
  canvasPadding: number;
  /** Backing-canvas fill color for the artboard's Background layer. The sentinel
   *  "transparent" ⇒ a fully-transparent fill (the checkerboard shows through);
   *  any #rrggbb hex ⇒ that opaque color. Only used when `canvasArtboard` is on. */
  canvasBgColor: string;
  /** Include the artboard's backing "Background" canvas layer (the padded
   *  fill `canvasArtboard` adds) when exporting/downloading/sharing the
   *  image. Off (default) ⇒ the backing canvas is a compositional guide only
   *  — exports crop to just the photo content. On ⇒ exports include the full
   *  padded canvas, fill and all. */
  exportCanvasBackground: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  maxHistory: 50,
  idleTimeoutMin: 30,
  theme: "dark",
  rulers: false,
  rulerUnit: "px",
  grid: false,
  gridKind: "square",
  gridSpacing: 50,
  gridCols: 4,
  gridRows: 3,
  gridColor: "#ffffff",
  gridOpacity: 40,
  reopenLastSession: true,
  reduceMotion: false,
  // Privacy-by-default: strip EXIF (GPS, capture time, lens, device serial) on
  // export unless the user explicitly opts in via Settings → Security.
  exifKeep: false,
  // 'all' preserves the pre-existing full-strip behavior exactly; 'location'
  // is an opt-in, less-aggressive choice (GPS only) surfaced alongside it.
  exifStripMode: "all",
  // Default to the Photoshop-style "Canvas + photo" two-layer load (Background +
  // Photo); users who want the classic single full-bleed layer switch it off in
  // Settings → Layers and Canvas.
  canvasArtboard: true,
  canvasPadding: 10,
  // Backing canvas defaults to transparent ⇒ the checkerboard shows through.
  canvasBgColor: "transparent",
  // Default OFF again (ADR-040, 2026-08-18) — reverses ADR-016's reversal, at
  // Chris's explicit request after the JPEG black-border report (ADR-039).
  // ADR-016's argument was "what you see on screen is what you get on export";
  // the counter-argument that won is that the backing canvas is padding the
  // user never asked for, arriving on every import, and quietly changing the
  // dimensions of every exported file. Including it is now opt-in.
  // NOTE: this changes the default only. An existing install keeps whatever is
  // already stored in `image-horse-prefs` — no forced migration.
  exportCanvasBackground: false,
};

const THEME_CHOICES: ThemeChoice[] = ["system", "dark", "light"];
const GRID_KINDS: GridKind[] = ["square", "golden", "grid"];

/** Clamp an integer pref into [min, max] with a fallback. */
function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, Math.round(v)))
    : fallback;
}

/** Validate a #rgb/#rrggbb(aa) hex, else fall back. */
function safeHex(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#([0-9a-fA-F]{3,8})$/.test(v) ? v : fallback;
}

/** History bounds — mirror the Rust settings policy (src/settings.rs). */
export const MAX_HISTORY_MIN = 50;
export const MAX_HISTORY_MAX = 1000;

const LS_KEY = "image-horse-prefs";

function clampHistory(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PREFERENCES.maxHistory;
  return Math.min(MAX_HISTORY_MAX, Math.max(MAX_HISTORY_MIN, Math.round(n)));
}

/** Coerce an arbitrary partial into a valid Preferences. */
function normalize(p: Partial<Preferences> | null | undefined): Preferences {
  const idle = p?.idleTimeoutMin;
  return {
    maxHistory: clampHistory(p?.maxHistory ?? DEFAULT_PREFERENCES.maxHistory),
    idleTimeoutMin:
      typeof idle === "number" && Number.isFinite(idle) && idle >= 0
        ? idle
        : DEFAULT_PREFERENCES.idleTimeoutMin,
    theme: THEME_CHOICES.includes(p?.theme as ThemeChoice)
      ? (p?.theme as ThemeChoice)
      : DEFAULT_PREFERENCES.theme,
    rulers: typeof p?.rulers === "boolean" ? p.rulers : DEFAULT_PREFERENCES.rulers,
    rulerUnit: RULER_UNITS.includes(p?.rulerUnit as RulerUnit)
      ? (p?.rulerUnit as RulerUnit)
      : DEFAULT_PREFERENCES.rulerUnit,
    grid: typeof p?.grid === "boolean" ? p.grid : DEFAULT_PREFERENCES.grid,
    gridKind: GRID_KINDS.includes(p?.gridKind as GridKind)
      ? (p?.gridKind as GridKind)
      : DEFAULT_PREFERENCES.gridKind,
    gridSpacing: clampInt(p?.gridSpacing, 8, 500, DEFAULT_PREFERENCES.gridSpacing),
    gridCols: clampInt(p?.gridCols, 1, 64, DEFAULT_PREFERENCES.gridCols),
    gridRows: clampInt(p?.gridRows, 1, 64, DEFAULT_PREFERENCES.gridRows),
    gridColor: safeHex(p?.gridColor, DEFAULT_PREFERENCES.gridColor),
    gridOpacity: clampInt(p?.gridOpacity, 5, 100, DEFAULT_PREFERENCES.gridOpacity),
    reopenLastSession:
      typeof p?.reopenLastSession === "boolean"
        ? p.reopenLastSession
        : DEFAULT_PREFERENCES.reopenLastSession,
    reduceMotion:
      typeof p?.reduceMotion === "boolean"
        ? p.reduceMotion
        : DEFAULT_PREFERENCES.reduceMotion,
    exifKeep:
      typeof p?.exifKeep === "boolean" ? p.exifKeep : DEFAULT_PREFERENCES.exifKeep,
    exifStripMode:
      p?.exifStripMode === "all" || p?.exifStripMode === "location"
        ? p.exifStripMode
        : DEFAULT_PREFERENCES.exifStripMode,
    canvasArtboard:
      typeof p?.canvasArtboard === "boolean"
        ? p.canvasArtboard
        : DEFAULT_PREFERENCES.canvasArtboard,
    canvasPadding: clampInt(p?.canvasPadding, 0, 200, DEFAULT_PREFERENCES.canvasPadding),
    canvasBgColor:
      p?.canvasBgColor === "transparent"
        ? "transparent"
        : safeHex(p?.canvasBgColor, DEFAULT_PREFERENCES.canvasBgColor),
    exportCanvasBackground:
      typeof p?.exportCanvasBackground === "boolean"
        ? p.exportCanvasBackground
        : DEFAULT_PREFERENCES.exportCanvasBackground,
  };
}

/** Map the backing-canvas color pref to the rgba the Rust artboard fill expects.
 *  The sentinel "transparent" ⇒ a:0 (checkerboard shows through); a #rrggbb hex
 *  ⇒ that opaque color. The actual fill happens in Rust (`set_artboard_border`);
 *  this only maps the chosen swatch to rgba. */
export function canvasBgToRgba(c: string): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  if (c === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = c.replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return {
    r: Number.isFinite(r) ? r : 255,
    g: Number.isFinite(g) ? g : 255,
    b: Number.isFinite(b) ? b : 255,
    a: 255,
  };
}

/** Canonical JSON — an EXPLICIT field order, so two devices that hold the same
 *  preferences produce byte-identical strings and the sync layer's equality
 *  check (a string compare) is exact. Adding a field means adding it HERE as
 *  well as to the interface; a field that is missing from this list is not
 *  persisted at all, let alone synced.
 *
 *  `rulerUnit` was exactly that until this commit: it shipped on the interface
 *  and in `normalize`, was never written here, and so was silently dropped by
 *  every reload — this is the only writer localStorage has. Appended at the
 *  END rather than beside `rulers`, because the order is the wire format: any
 *  other position renames nothing but changes every stored blob, which would
 *  read to every signed-in device as "the other device changed something". */
export function serializePreferences(p: Preferences): string {
  return JSON.stringify({
    maxHistory: p.maxHistory,
    idleTimeoutMin: p.idleTimeoutMin,
    theme: p.theme,
    rulers: p.rulers,
    grid: p.grid,
    gridKind: p.gridKind,
    gridSpacing: p.gridSpacing,
    gridCols: p.gridCols,
    gridRows: p.gridRows,
    gridColor: p.gridColor,
    gridOpacity: p.gridOpacity,
    reopenLastSession: p.reopenLastSession,
    reduceMotion: p.reduceMotion,
    exifKeep: p.exifKeep,
    exifStripMode: p.exifStripMode,
    canvasArtboard: p.canvasArtboard,
    canvasPadding: p.canvasPadding,
    canvasBgColor: p.canvasBgColor,
    exportCanvasBackground: p.exportCanvasBackground,
    rulerUnit: p.rulerUnit,
  });
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? normalize(JSON.parse(raw)) : { ...DEFAULT_PREFERENCES };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function savePreferences(p: Preferences): void {
  try {
    localStorage.setItem(LS_KEY, serializePreferences(p));
  } catch {
    // localStorage may be unavailable (private mode / quota); ignore.
  }
}

// ── The live value, and the seam the sync layer plugs into ──────────────────
//
// ONE module-level value, not one useState per caller. More than one component
// calls usePreferences() (AppShell owns the applied prefs; the command palette
// hot-toggles rulers/grid/theme), and before this was module state each of them
// held its own copy that drifted until a reload. Now they all read the same
// value through useSyncExternalStore and a commit wakes every one of them.
//
// This is also what makes the sync layer possible without an import cycle:
// lib/sync/docs.ts reads `readPreferences`, writes `adoptPreferences`, and
// listens on `subscribePreferences`. It knows about preferences; preferences
// knows nothing about it.
let currentPreferences: Preferences = loadPreferences();

const prefListeners = new Set<(p: Preferences) => void>();

/** Commit a value: normalize, store, persist, wake every listener. The single
 *  writer — a user edit and an adopted remote value take the same path, so
 *  there is no second way for the applied preferences to change. Exported as
 *  the non-React way to make a user edit (what `usePreferences`' `apply`
 *  calls), which is also how the sync tests drive the real path. */
export function commitPreferences(next: Preferences): Preferences {
  const value = normalize(next);
  currentPreferences = value;
  savePreferences(value);
  for (const listener of prefListeners) listener(value);
  return value;
}

/** The preferences the app is applying right now. Stable between commits —
 *  useSyncExternalStore compares snapshots by identity. */
export function readPreferences(): Preferences {
  return currentPreferences;
}

/** Subscribe to commits. Returns the unsubscribe. */
export function subscribePreferences(listener: (p: Preferences) => void): () => void {
  prefListeners.add(listener);
  return () => {
    prefListeners.delete(listener);
  };
}

/** Apply a value that arrived from another tab or another device. Identical to
 *  a local commit on purpose: a preference adopted from a phone must reach the
 *  engine and the UI by exactly the path a preference set here does, or the
 *  two devices agree about the stored blob and disagree on screen. */
export function adoptPreferences(p: Preferences): void {
  commitPreferences(p);
}

/** Parse a serialized blob from elsewhere. `null` rejects it (malformed JSON
 *  or a non-object), which leaves this device on its own value. Anything that
 *  IS an object goes through `normalize`, so an unknown or out-of-range field
 *  from another build clamps to a default rather than landing in state. */
export function parsePreferences(json: string): Preferences | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalize(parsed as Partial<Preferences>);
  } catch {
    return null;
  }
}

/**
 * Live preferences + an `apply` that commits them.
 *
 * Applying writes localStorage and wakes every other caller in this tab
 * immediately. Propagation beyond that — the other tabs, and the user's other
 * devices when signed in — is the sync layer's job and happens off the same
 * commit; nothing here waits on a network, and a signed-out user gets the
 * cross-tab half regardless.
 */
export function usePreferences() {
  const prefs = useSyncExternalStore(subscribePreferences, readPreferences, readPreferences);
  const apply = useCallback((next: Preferences) => {
    commitPreferences(next);
  }, []);
  return [prefs, apply] as const;
}
