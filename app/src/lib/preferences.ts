// App-wide user preferences (the Settings → General tab). Persisted to
// localStorage; read once at startup and applied (e.g. maxHistory → WASM engine).
import { useCallback, useState } from "react";

export interface Preferences {
  /** Undo-history depth applied to the WASM engine (50–1000). */
  maxHistory: number;
  /** Minutes of inactivity before the idle screen; 0 = never. */
  idleTimeoutMin: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  maxHistory: 50,
  idleTimeoutMin: 30,
};

/** History bounds — mirror the Rust settings policy (src/settings.rs). */
export const MAX_HISTORY_MIN = 50;
export const MAX_HISTORY_MAX = 1000;

const LS_KEY = "image-horse-prefs";

export function clampHistory(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PREFERENCES.maxHistory;
  return Math.min(MAX_HISTORY_MAX, Math.max(MAX_HISTORY_MIN, Math.round(n)));
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const p = JSON.parse(raw) as Partial<Preferences>;
    return {
      maxHistory: clampHistory(p.maxHistory ?? DEFAULT_PREFERENCES.maxHistory),
      idleTimeoutMin:
        Number.isFinite(p.idleTimeoutMin) && (p.idleTimeoutMin as number) >= 0
          ? (p.idleTimeoutMin as number)
          : DEFAULT_PREFERENCES.idleTimeoutMin,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function savePreferences(p: Preferences): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    // localStorage may be unavailable (private mode / quota); ignore.
  }
}

/** Preferences as React state, persisted to localStorage on every change. */
export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePreferences(next);
      return next;
    });
  }, []);
  return [prefs, update] as const;
}
