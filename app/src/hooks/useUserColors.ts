// User-added colours — the global "+" palette — live globally and sync across
// every ColorSwatchGrid / ColorPickerDialog instance.
//
// Two backings, picked by auth state (the same split as useRecentTexts):
//   • signed out  → localStorage, the "no-login cache". In-tab updates
//                   broadcast via a custom event so all hook instances refresh
//                   without depending on the storage event (which doesn't fire
//                   in the same tab).
//   • signed in   → the Convex `user_colors` table (convex/userColors.ts), so
//                   the palette follows the user across devices. Convex's
//                   reactive query keeps every instance in step for free.
// A failed Convex write falls back to the local list so the click is never
// silently lost.
import { useSyncExternalStore, useCallback } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const LS_KEY = "image-horse-user-colors";
const CHANGE_EVENT = "image-horse-user-colors-change";
/** Mirrors MAX_USER_COLORS in convex/userColors.ts — change both. */
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

function lsAdd(color: string) {
  const c = color.trim();
  if (!c) return;
  const key = norm(c);
  const current = lsLoad();
  if (current.some((existing) => norm(existing) === key)) return;
  lsSave([c, ...current].slice(0, MAX_USER_COLORS));
}

function lsRemove(color: string) {
  const key = norm(color);
  const current = lsLoad();
  const next = current.filter((c) => norm(c) !== key);
  if (next.length === current.length) return;
  lsSave(next);
}

export function useUserColors() {
  // useConvexAuth.isAuthenticated is true only after Convex completes the JWT
  // handshake — unlike Clerk's isSignedIn which stays true even when the
  // Convex auth provider rejects the token (e.g. dev keys vs prod deployment).
  const { isAuthenticated } = useConvexAuth();

  const localColors = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const convexColors = useQuery(
    api.userColors.listUserColors,
    isAuthenticated ? {} : "skip",
  );
  const addMutation = useMutation(api.userColors.addUserColor);
  const removeMutation = useMutation(api.userColors.removeUserColor);

  // While the first Convex result is still in flight (`undefined`) show the
  // local list rather than an empty row, so the "+" swatches don't blink out
  // for a beat on sign-in.
  const userColors: string[] = isAuthenticated
    ? (convexColors ?? localColors)
    : localColors;

  const addColor = useCallback(
    (color: string) => {
      const c = color.trim();
      if (!c) return;
      if (isAuthenticated) {
        addMutation({ color: c }).catch(() => lsAdd(c));
      } else {
        lsAdd(c);
      }
    },
    [isAuthenticated, addMutation],
  );

  const removeColor = useCallback(
    (color: string) => {
      if (isAuthenticated) {
        removeMutation({ color }).catch(() => lsRemove(color));
      } else {
        lsRemove(color);
      }
    },
    [isAuthenticated, removeMutation],
  );

  return { userColors, addColor, removeColor };
}
