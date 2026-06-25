// App-wide user preferences (Settings → General/Appearance). Persisted to
// localStorage immediately, and — when signed in — synced to the Convex `users`
// row as a JSON blob + its SHA-256 (so we skip redundant writes and can verify
// on load). Logged-out users stay localStorage-only.
import { useCallback, useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { sha256Hex } from "@/lib/originalsStore";
import { logDiagnostic } from "@/lib/diagnosticsLog";

export type ThemeChoice = "system" | "dark" | "light";

/** Canvas grid layout: uniform px squares, golden-ratio lines, or N×M divisions. */
export type GridKind = "square" | "golden" | "grid";

export interface Preferences {
  /** Undo-history depth applied to the WASM engine (50–1000). */
  maxHistory: number;
  /** Minutes of inactivity before the idle screen; 0 = never. */
  idleTimeoutMin: number;
  /** Appearance theme (light / dark / system). */
  theme: ThemeChoice;
  // ── Rulers & Grids (canvas overlays; non-destructive) ──────────────────────
  /** Show top + left pixel rulers along the canvas. */
  rulers: boolean;
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
}

export const DEFAULT_PREFERENCES: Preferences = {
  maxHistory: 50,
  idleTimeoutMin: 30,
  theme: "dark",
  rulers: false,
  grid: false,
  gridKind: "square",
  gridSpacing: 50,
  gridCols: 4,
  gridRows: 3,
  gridColor: "#ffffff",
  gridOpacity: 40,
  reopenLastSession: true,
  reduceMotion: false,
  exifKeep: true,
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

export function clampHistory(n: number): number {
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
  };
}

/** Canonical JSON (explicit field order) so the hash is stable across builds. */
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
  });
}

export async function hashPreferences(p: Preferences): Promise<string> {
  return sha256Hex(new TextEncoder().encode(serializePreferences(p)));
}

export function loadPreferences(): Preferences {
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

/**
 * Live preferences + an `apply` that commits them. Reads localStorage first;
 * when signed in, pulls the Convex-saved settings (server wins on load) and
 * pushes on apply as a JSON blob + SHA-256, skipping the write when the hash is
 * unchanged.
 */
export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const saveSettings = useMutation(api.users.saveSettings);
  // Last hash reconciled with the server — guards the pull (don't re-adopt our
  // own write) and the push (skip identical writes).
  const syncedHashRef = useRef<string | null>(null);

  // Pull: adopt the server's settings when they differ from what we last synced.
  useEffect(() => {
    if (!me || !me.settings || !me.settingsHash) return;
    if (me.settingsHash === syncedHashRef.current) return;
    try {
      const remote = normalize(JSON.parse(me.settings));
      syncedHashRef.current = me.settingsHash;
      setPrefs(remote);
      savePreferences(remote);
    } catch {
      // malformed server blob — keep local
    }
  }, [me]);

  const apply = useCallback(
    (next: Preferences) => {
      const value = normalize(next);
      setPrefs(value);
      savePreferences(value);
      if (!isAuthenticated) return;
      void (async () => {
        const hash = await hashPreferences(value);
        if (hash === syncedHashRef.current) return; // unchanged
        syncedHashRef.current = hash;
        try {
          await saveSettings({ settings: serializePreferences(value), hash });
        } catch (err) {
          syncedHashRef.current = null; // allow a retry on the next apply
          logDiagnostic(
            "CONVEX_DB",
            `Settings sync failed (saved locally): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      })();
    },
    [isAuthenticated, saveSettings],
  );

  return [prefs, apply] as const;
}
