// A swatch palette the user can edit: it starts as the site's own colors and
// the user can replace any swatch, remove one, or add their own. Kept per
// palette (`key`) in localStorage — the no-login cache, the same backing the
// signed-out global palette uses (useUserColors). Every grid showing the same
// key stays in step in this tab (the listener set below, no window event)
// and across tabs (the browser's storage event).
//
// Nothing is stored until the user edits: an untouched palette IS the
// defaults, so a new site color shows up without a migration.
import { useCallback, useMemo, useSyncExternalStore } from "react";

const LS_PREFIX = "image-horse-palette:";
/** This tab's subscribers: a write calls them directly. */
const listeners = new Set<() => void>();
/** Same cap as the global palette (MAX_USER_COLORS). */
export const MAX_PALETTE_COLORS = 32;

function storageKey(key: string) {
  return LS_PREFIX + key;
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
}

function parse(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((c): c is string => typeof c === "string" && c.trim() !== "");
  } catch {
    return null;
  }
}

function write(key: string, colors: string[] | null) {
  try {
    if (colors === null) localStorage.removeItem(storageKey(key));
    else localStorage.setItem(storageKey(key), JSON.stringify(colors));
  } catch {
    // localStorage may be unavailable (private mode, quota); the edit is
    // dropped, the palette stays as it was.
  }
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

const norm = (c: string) => c.trim().toLowerCase();

export interface EditablePalette {
  colors: readonly string[];
  /** True once the user has changed it from the site's colors. */
  edited: boolean;
  /** Swap the swatch at `index` for `color`. A color already elsewhere in
   *  the palette moves here instead of appearing twice. */
  replace: (index: number, color: string) => void;
  /** Append `color` (no-op if it is already there or the palette is full). */
  add: (color: string) => void;
  remove: (index: number) => void;
  /** Back to the site's colors. */
  reset: () => void;
}

export function useEditablePalette(key: string, defaults: readonly string[]): EditablePalette {
  // The raw string is the snapshot: stable between renders, so
  // useSyncExternalStore needs no cache of its own.
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  const stored = useMemo(() => parse(raw), [raw]);
  const colors = stored ?? defaults;

  const commit = useCallback(
    (next: string[]) => {
      const same =
        next.length === defaults.length && next.every((c, i) => norm(c) === norm(defaults[i]));
      write(key, same ? null : next);
    },
    [key, defaults],
  );

  const current = useCallback(() => parse(readRaw(key)) ?? [...defaults], [key, defaults]);

  const replace = useCallback(
    (index: number, color: string) => {
      const c = color.trim();
      const list = current();
      if (!c || index < 0 || index >= list.length) return;
      const next: string[] = [];
      list.forEach((existing, i) => {
        if (i === index) next.push(c);
        else if (norm(existing) !== norm(c)) next.push(existing);
      });
      commit(next);
    },
    [current, commit],
  );

  const add = useCallback(
    (color: string) => {
      const c = color.trim();
      const list = current();
      if (!c || list.length >= MAX_PALETTE_COLORS) return;
      if (list.some((existing) => norm(existing) === norm(c))) return;
      commit([...list, c]);
    },
    [current, commit],
  );

  const remove = useCallback(
    (index: number) => {
      const list = current();
      if (index < 0 || index >= list.length) return;
      commit(list.filter((_, i) => i !== index));
    },
    [current, commit],
  );

  const reset = useCallback(() => write(key, null), [key]);

  return { colors, edited: stored !== null, replace, add, remove, reset };
}
