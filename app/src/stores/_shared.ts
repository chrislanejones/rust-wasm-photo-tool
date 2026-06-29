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
