// User-added colors live globally and sync across every ColorSwatchGrid
// instance. Persisted to localStorage; in-tab updates broadcast via a custom
// event so all hook instances refresh without depending on the storage event
// (which doesn't fire in the same tab).
import { useSyncExternalStore, useCallback } from "react";

const LS_KEY = "image-horse-user-colors";
const CHANGE_EVENT = "image-horse-user-colors-change";
const MAX_USER_COLORS = 32;

function lsLoad(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is string => typeof c === "string");
  } catch {
    return [];
  }
}

function lsSave(colors: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(colors));
  } catch {
    // localStorage may be unavailable (private mode, quota); silently drop.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// useSyncExternalStore requires snapshot stability — cache + invalidate on event.
let _cached: string[] | null = null;
function getSnapshot(): string[] {
  if (_cached === null) _cached = lsLoad();
  return _cached;
}
function invalidate() {
  _cached = null;
}

if (typeof window !== "undefined") {
  window.addEventListener(CHANGE_EVENT, invalidate);
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY) invalidate();
  });
}

const emptyServerSnapshot: string[] = [];
function getServerSnapshot(): string[] {
  return emptyServerSnapshot;
}

/** Normalize for de-dup: lowercase, drop whitespace. */
function norm(c: string): string {
  return c.trim().toLowerCase();
}

export function useUserColors() {
  const colors = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addColor = useCallback((color: string) => {
    const c = color.trim();
    if (!c) return;
    const key = norm(c);
    const current = lsLoad();
    if (current.some((existing) => norm(existing) === key)) return;
    const next = [c, ...current].slice(0, MAX_USER_COLORS);
    lsSave(next);
  }, []);

  const removeColor = useCallback((color: string) => {
    const key = norm(color);
    const current = lsLoad();
    const next = current.filter((c) => norm(c) !== key);
    if (next.length === current.length) return;
    lsSave(next);
  }, []);

  return { userColors: colors, addColor, removeColor };
}
