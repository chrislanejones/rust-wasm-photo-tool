# ADR-077: `@testing-library/react` is an app-level devDependency, and component tests opt into jsdom one file at a time
Date: 2026-10-01   Status: accepted (10-01-2026)

## Context

Nothing in this repo had ever rendered a React component in a test. **139 test
files, every one in the `node` environment** — Dexie, the engine, pure logic —
so Night 2's ARIA work and Plan A's thumbnail rule had no watcher of any kind.

Two things blocked it, and the second is the one worth knowing:

1. `@testing-library/react` was not installed. `vitest` 5 and `jsdom` 29
   already were; the renderer was the only missing piece.
2. `app/vitest.config.ts` globbed `include: ["src/**/*.{test,spec}.ts"]` —
   **`.ts` only**, so a `*.test.tsx` was never COLLECTED. It produced no
   failure and no pass; it simply did not run. Verified by reverting the glob:
   **140 files / 1,547 tests** with the new file sitting on disk, a green run
   that could not see it.

## Decision

`@testing-library/react` **^16.3.3** in `app/package.json` devDependencies —
app-level, not the root, not the crate. The glob gains `.tsx`.

**The environment stays `node` globally.** A component file opts in with a
`// @vitest-environment jsdom` docblock on line 1. Three shims live in
`app/vitest.setup.ts`, all guarded on `typeof document !== "undefined"`
because that same setup file runs for the node tests:

| Shim | Why it is needed |
|---|---|
| `matchMedia` | framer-motion reads it **on import**; jsdom has none. Answers non-matching, i.e. motion allowed |
| `ResizeObserver` | absent in jsdom, and several primitives construct one |
| `cleanup` on `afterEach` | wired **by hand**: Testing Library's automatic cleanup hooks `afterEach` off the **global** scope, and this project runs `globals: false`, so it never registered and every render leaked into the next test |

Each of the four new files was broken once on purpose, per ADR-071 rule 4:
9 / 6 / 1 / 1 kills (mutations and counts in `1f11d5ca`). Suite goes
**144 files / 1,582 tests** (+4 files, +35).

## Consequences

+ Three assertions that could not be made at all before: a thumbnail decode
  inside its grace period draws **nothing**, every branch of a gallery tile is
  in flow at the same size, and `aria-busy` is reported up and cleared on
  unmount.
+ TOGGLE / SELECT / ACTION semantics for `ToggleButtonGroup` and
  `ToolButtonGroup` are pinned. Those modes **look identical on screen**, so a
  mode regression is invisible to a screenshot and to a human.
+ ~139 node files keep a node environment they are faster and simpler in.
- **The opt-in is a thing to remember, and nothing enforces it.** A `.test.tsx`
  without the docblock dies on `document is not defined`, which reads like
  "components can't be tested here" rather than "you forgot line 1."
- `vitest.setup.ts` now has two personalities. A shim that is subtly wrong
  under jsdom is invisible to every node file, and `matchMedia` always
  answering "motion allowed" means the Reduce Motion paths are never
  exercised unless a file overrides it.
- **jsdom is not a browser.** `new Image()` never loads, so the thumbnail tests
  supply a stub probe — the loaded path is reachable only because a test fakes
  it. Layout assertions are about flow and classes, never pixels.
- One more devDependency on the app install, version-coupled to React 19.

## Alternatives rejected

1. **`environment: "jsdom"` globally.** Would put ~139 Dexie/engine files
   through a DOM they do not need, for slower runs and new failure modes in
   files that never touch one.
2. **Leave component behavior to Playwright.** `ci.yml` runs only
   `no-sw-default.spec.ts` and `test:e2e:sw`; the other **70** e2e tests are a
   local-only gate (`6b0e587a`) — so the slower, less-watched tool would have
   owned the fastest assertions.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: **the opt-in
never became a habit.** Four files carry the docblock, the next person adds a
fifth without it, reads `document is not defined` as a wall, and component
tests stay a Night-7 curiosity while the primitives keep growing. The split
then costs twice — a config nobody understands guarding a capability nobody
uses.
Early warning sign: the count of files containing `@vitest-environment jsdom`
still sitting at **four** after the next batch of UI work lands.
