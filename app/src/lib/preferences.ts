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

export interface Preferences {
  /** Undo-history depth applied to the WASM engine (50–1000). */
  maxHistory: number;
  /** Minutes of inactivity before the idle screen; 0 = never. */
  idleTimeoutMin: number;
  /** Appearance theme. Persisted, but not yet applied (app is dark-only). */
  theme: ThemeChoice;
}

export const DEFAULT_PREFERENCES: Preferences = {
  maxHistory: 50,
  idleTimeoutMin: 30,
  theme: "dark",
};

const THEME_CHOICES: ThemeChoice[] = ["system", "dark", "light"];

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
  };
}

/** Canonical JSON (explicit field order) so the hash is stable across builds. */
export function serializePreferences(p: Preferences): string {
  return JSON.stringify({
    maxHistory: p.maxHistory,
    idleTimeoutMin: p.idleTimeoutMin,
    theme: p.theme,
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
