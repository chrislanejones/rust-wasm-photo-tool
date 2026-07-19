// Shared helper for Zustand stores.
//
// Our stores replace `useState` call sites verbatim, so their setter actions
// must accept the SAME argument React's setState does: either a new value or an
// updater function `(prev) => next`. `resolveSet` collapses both forms to the
// next value. This is what lets `setShowTools((v) => !v)` and the ~30 other
// functional-updater call sites in AppShell keep working untouched after the
// migration off local state.
//
// Caveat (identical to React's): if a piece of state were itself a function we
// couldn't tell a value from an updater — but none of our state is a function,
// so this is safe.
export type SetArg<T> = T | ((prev: T) => T);

export function resolveSet<T>(arg: SetArg<T>, prev: T): T {
  return typeof arg === "function" ? (arg as (prev: T) => T)(prev) : arg;
}

// Hydration guards for persisted stores.
//
// `persist`'s default `merge` trusts whatever comes back from IndexedDB
// verbatim — but that blob is same-origin-writable (another tab, an old
// build still cached, a future rename of one of these union values) and
// isn't re-checked against the CURRENT code's types on the way in. These run
// inside each persisted store's `merge` (not `migrate` — `migrate` only
// fires on a version bump; `merge` runs on every rehydrate, which is what a
// standing validation guard needs) so a value the running code no longer
// recognizes falls back to the in-code default instead of rehydrating as-is.

/** Narrows a rehydrated value to one of `allowed`, falling back to
 *  `fallback` if it's missing, corrupted, or a value this build's union no
 *  longer has (e.g. a sub-mode renamed or dropped since the blob was written). */
export function validated<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

/** Coerces a rehydrated value to an array of strings, dropping non-string
 *  entries and falling back to `[]` if the value itself isn't an array. */
export function validatedStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Coerces a rehydrated value to a plain string→number record, dropping any
 *  entry whose value isn't a number and falling back to `{}` if the value
 *  itself isn't an object. */
export function validatedNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number") out[k] = v;
  }
  return out;
}

/** Coerces a rehydrated value to a plain object, falling back to `{}` if the
 *  value isn't one. Use for record-shaped fields with no fixed key set (so
 *  no per-key check applies) — still guards against a non-object blob. */
export function validatedRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
