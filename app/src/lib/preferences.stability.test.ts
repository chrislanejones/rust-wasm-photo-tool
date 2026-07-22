// Guards a load-bearing invariant that nothing else enforces.
//
// `SubscriptionButton.tsx:172` runs:
//     useEffect(() => { if (open) setDraft(general.current); }, [open, general.current]);
// an effect that writes state while its own dependency array contains that
// state's source. That is safe TODAY for exactly one reason: `usePreferences()`
// returns the `prefs` value straight out of `useState`, so its identity is
// stable across renders and the effect does not re-fire on every render.
//
// Nothing in the type system or the linter enforces that. The moment
// `usePreferences` starts BUILDING its return value per render — a spread, a
// `normalize()` call, a fresh object literal, `useMemo` with a wrong dep — the
// identity changes every render, the effect re-fires, it calls `setDraft`, that
// re-renders, and the Settings modal hard-locks. See ADR-020.
//
// This is a source-shape assertion rather than a render test on purpose: the
// repo has no React testing-library and vitest runs in the `node` environment,
// so pinning the shape is the cheapest honest guard. If someone deliberately
// changes the contract, this test is where they find out what it protected.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE = readFileSync(
  fileURLToPath(new URL("./preferences.ts", import.meta.url)),
  "utf8",
);

/** The body of `export function usePreferences() { … }`, to the first
 *  column-0 closing brace. */
function usePreferencesBody(): string {
  const start = SOURCE.indexOf("export function usePreferences()");
  expect(
    start,
    "usePreferences() was renamed or removed — re-point this guard, do not delete it",
  ).toBeGreaterThan(-1);
  const end = SOURCE.indexOf("\n}", start);
  expect(end).toBeGreaterThan(start);
  return SOURCE.slice(start, end);
}

describe("usePreferences identity contract", () => {
  it("holds prefs in useState, so its identity is stable across renders", () => {
    const body = usePreferencesBody();
    expect(
      /const\s*\[\s*prefs\s*,\s*setPrefs\s*\]\s*=\s*useState\b/.test(body),
      "`prefs` is no longer a plain useState value. SubscriptionButton.tsx:172 " +
        "depends on its referential stability — see ADR-020 before changing this.",
    ).toBe(true);
  });

  it("returns that useState value verbatim, never a per-render object", () => {
    const body = usePreferencesBody();
    const ret = body.match(/return\s*\[([^\]]*)\]\s*as const/);
    expect(
      ret,
      "usePreferences no longer returns a `[value, apply] as const` tuple — " +
        "re-point this guard rather than removing it",
    ).not.toBeNull();

    const first = ret![1].split(",")[0].trim();
    expect(
      first,
      "usePreferences must return the `prefs` binding ITSELF, not a value built " +
        "during render (a spread, normalize(), a fresh literal, or a useMemo). " +
        "Returning a new identity each render makes the effect at " +
        "SubscriptionButton.tsx:172 re-fire on every render and hard-locks the " +
        "Settings modal. If you intend to change this contract, fix that effect " +
        "first — see ADR-020.",
    ).toBe("prefs");
  });
});
