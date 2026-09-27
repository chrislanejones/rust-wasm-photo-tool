# AppShell refactor plan

Written 2026-09-27. Replaces the 2026-09-26 version of this file, which was
sound and never ran: the PR that shipped it (#247) executed the pure-function
moves in `CanvasArea` and `useDrawingTools` and nothing in AppShell. ADR-042
is the decision; this file is the *how*, with today's numbers and one
addition (B0) that makes the first real step safe.

## Where things stand on 2026-09-27

| File | Lines | eslint cap | Headroom |
| --- | ---: | ---: | ---: |
| `app/src/app/AppShell.tsx` | 3,716 | 3,716 | 0 |
| `app/src/features/canvas/CanvasArea.tsx` | 2,823 | 2,823 | 0 |
| `app/src/features/tools/settings/BatchSettings.tsx` | 1,428 | 1,428 | 0 |
| `app/src/hooks/useDrawingTools.ts` | 991 | 991 | 0 |
| `app/src/hooks/useEngineCore.ts` | 900 | (warn line) | 0 |

Every capped file sits at exactly zero headroom, and the caps are `error`.
That is the ratchet doing its job. It also means the next feature that
touches AppShell fails lint on its first line, and the only ways out are to
move something unrelated or raise the number. This plan exists so that the
next feature does not touch AppShell at all.

Rust, code vs test (measured, first `#[cfg(test)]` module to its close):

| File | Total | Tests | Real code |
| --- | ---: | ---: | ---: |
| `src/lib.rs` | 4,671 | 1,214 | 3,457 |
| `src/ops.rs` | 3,654 | 1,651 | 2,003 |
| `src/annotations.rs` | 2,659 | 170 | 2,489 |
| `src/layer.rs` | 2,342 | 346 | 1,996 |

## The diagnosis, unchanged

AppShell is the composition root, and it reads the stores on its children's
behalf. Measured in the file today:

- 123 store subscriptions in one component: `useUIStore` ×52,
  `useToolStore` ×37, `useGalleryStore` ×21, `useAnnotationStore` ×9,
  `useGuidesStore` ×4.
- Those values go back down as props: `<ToolsSidebar>` 77, `<CanvasArea>`
  46 (a 60-field `Props`), `<ReviewPanel>` 32, `<TopBar>` 23 — each with a
  `handleXChange` wrapper (ADR-042 counted ~213).
- The JSX return is 1,008 lines that handler extraction never touches.
- There is no `createContext` and no `React.memo` anywhere in `app/src`.

So a new feature has nowhere to go except another prop, another handler and
another line in the return. That is the accretion mechanism, and it is why the
file grew while being dismantled. ADR-042's arithmetic still holds: the best
single handler extraction is 103 lines (2.7%), and twenty more of them end
near 2,500. Extraction is not the fix. Changing who reads the stores is.

## Libraries: what was considered, and the decision

The question "would TanStack help" was asked and answered on 2026-09-27.
Recording it here so it is not re-asked every quarter.

**Not adopted, and not for size reasons.** TanStack is incremental by design,
so "too late" never applies; it is that its problems are not this repo's:

| Library | Solves | Already here |
| --- | --- | --- |
| TanStack Query | server-state cache + refetch | Convex `useQuery`/`useMutation` in 10 files is already a reactive cache; a second one on top is two caches for one dataset |
| TanStack Router | route tree, loaders | `features/routing/` — a hash router that appears in no pain table |
| TanStack Virtual | long lists | possibly `GalleryBar.tsx` (850 lines) if it mounts every thumbnail; small, and separate from this plan |
| Jotai / Valtio / Redux | a different store | seven working Zustand stores. The stores are fine; the *reader* is wrong |
| XState | interaction state machines | the right *shape* for tool sessions, the wrong weight. Done as a discriminated union in `useToolStore` instead (B4) |
| Immer | nested updates | optional; add only if B2 makes a setter ugly |
| Zod / Valibot | rehydration guards | could replace `stores/_shared.ts` `validated`/range helpers with `schema.catch(default)`; do it on a store's next version bump, not now |

**Adopted, in this order:**

1. **React Compiler** (`babel-plugin-react-compiler`, via the
   `@vitejs/plugin-react` babel option). React 19 is already here and
   `eslint.config.compiler.mjs` already probes its rule set. Zero `memo` in
   the app means every AppShell render re-renders every child, and it is
   exactly the risk B1 carries (a context value whose identity changes per
   stroke). The compiler removes that risk before the context exists.
2. **`eslint-plugin-boundaries`** (or `import/no-restricted-paths`). The
   2026-09-26 audit found `lib/tiers.ts` importing from a component and
   `useUIStore` importing `SettingsTab` from `SubscriptionButton.tsx`. Fixed
   by hand, they come back. `lib/` imports nothing above it; `stores/`
   imports `lib/` only; `features/x/` does not import `features/y/`. A lint
   error, in the style of the ratchet.
3. **`knip`** in place of `scripts/dead-exports-audit.mjs`, which counts a
   test file as a "user" and so misses `rgbToHsl`, `liveEnginePort` and the
   like; knip also reports unused files and dependencies.
4. **`useShallow` from `zustand/shallow`** — no new dependency. It is the
   idiom for a child reading three or four keys in B2, replacing three or
   four single-key selectors or one prop from AppShell.

## The plan

Four tracks. A and D are mechanical and independent. B is the point. C is
where the new features go, and it is sequenced *after* B1 on purpose.

### Track A — mechanical, no design decision, first

- `lib.rs` `layer_tests` + `layer_persistence_tests` → `src/lib_tests.rs`
  (`#[cfg(test)] mod lib_tests;`). `ops.rs` `mod tests` +
  `mod v2_migration_tests` → `src/ops_tests.rs` / `src/ops_migration_tests.rs`.
  ~2,900 lines, zero production risk. The eleven `fn solid(w, h, rgba)` test
  helpers collapse into one `#[cfg(test)] mod test_util` on the way.
- Hook re-homing. `app/src/hooks` is 38 hooks. Engine core stays
  (`useEngineCore`, `useCloneStamp`, `useLayers`, `useExport`, `useHistory`,
  `useTransforms`, `useCanvasCoords`, `useEffectiveTool`). Tool-specific
  hooks go to `features/tools/<tool>/`: drawing (`useDrawingTools`,
  `useShapeZOrderMenu`), text (`useTextTool`, `useRecentTexts`,
  `useEngineFaces`), paint (`usePaintTool`, `useBrushPreview`), stamp
  (`useRedStampTool`, `useEmojiTool`), `usePerspectiveTool`,
  `useMagicEraserTool`, `useMoveLayerTool`, `usePastePlacementTool`, color
  (`useColorPicker`, `useUserColors`). Diagnostics → `features/diagnostics/`.
  `hooks/stamp_tool.d.ts` is the wasm API declaration, not a hook →
  `lib/engine/` (update `engine-call-audit.mjs`, `engine-rmw-audit.mjs`,
  `snapshot-parameter-audit.mjs` and the contract test).
- `knip` + boundaries lint added; the two known inversions (`UserMode` is
  already fixed; `SettingsTab` is not) fixed under the new rule.

### Track B — AppShell, one PR per step, cap lowered in the same commit

**B0 — React Compiler, annotation mode.** Install the plugin, enable with
`compilationMode: "annotation"`, and annotate `ToolsSidebar`, `CanvasArea`,
`ReviewPanel`, `TopBar` with `"use memo"`. Run
`npx eslint app/src --config eslint.config.compiler.mjs` and fix what it
names in those four files only. Flip to `infer` once the probe config is
clean repo-wide — that is a later commit, not this one. Also in B0: add the
props-count guardrail to `scripts/guardrails.sh` — the number of props on
`<ToolsSidebar` and `<CanvasArea` inside AppShell (77 and 46 today) — so the
thing this plan reduces has its own ratchet, not just a line count.

Half a day. No behaviour change. Its only job is to make B1 safe.

**B1 — SessionContext.** `app/session/SessionContext.tsx` provides the hook
instances AppShell already owns: `stamp` (the engine facade from
`useCloneStamp`), `drawingTools`, `pastePlacement`, `canvasRef`. Children
call `useSession()` instead of receiving `onBrightness`, `onFlipH`,
`onApplyCrop`, `onSelectLayer`, … as props.

Context rather than a store because these are functions bound to a hook
instance with refs inside — not serialisable state and not something a
persisted store should own (ADR-026).

Split the value: a stable *actions* object in one context; engine *state*
(`layers`, `undoCount`, `levels`, `presets`) through the
`useSyncExternalStore` path ADR-026 already established. B0 makes the
"identity changes per stroke" failure a compiler concern rather than a
hand-memoization one, but the split is still the right shape.

Removes ~30 callback props from ToolsSidebar/CanvasArea and every
pass-through line between AppShell and the leaf that calls them.

**B2 — children read the stores.** `activeTool`, `toolSettings`,
`cropRatio`, `exportFormat`, `quality`, `prefs`, `photos`, `stampSettings`,
`shapesMode`, `brushMode`, … already live in a store. The panel that needs
one reads it with a selector (or `useShallow` for several); the
`handleXChange` wrapper in AppShell that only calls `set` is **deleted, not
moved**. This is where the line count falls, and it improves render
granularity: a selector subscribes to one key where a prop from AppShell
re-rendered on any AppShell render.

Rules: each deleted handler is read, not pattern-replaced. A handler that
does two things (sets a key *and* flushes the canvas, or resets another key)
stays, or becomes a session hook with its reasoning intact. The
exhaustive-deps override in `eslint.config.mjs` explains why store setters
pulled with `useStore(s => s.setX)` look like missing deps and are not.

Removes the bulk of the ~213 glue handlers and ~40 more props.

**B3 — split the JSX return.** Only viable after B1–B2; before them the new
components need the same 77 props.

- `<CanvasContextMenu>` — the 12 `ContextMenuItem`s and their shortcuts.
- `<ShellDialogs>` — three `ConfirmDialog`s, `UploadDialog`, `ShortcutModal`,
  `UpdatePrompt`, `ResumeContent`, `Toaster`.
- `<SidebarDock>` — `ToolsSidebar` + `MasterBar` wiring and the narrow-window
  drawer bookkeeping.
- `<Workspace>` — the two `CanvasArea` arms. **Keep the ternary's shape**:
  ADR-024 a11.1 needs the canvas element identity owned by AppShell precisely
  because those arms mount and unmount.

Removes ~700 of the 1,008 JSX lines.

**B4 — the tool session as a state machine, then CanvasArea.** `useToolStore`
(568 lines) plus CanvasArea's drag state is a state machine written as
independent booleans. Model it as one discriminated union in the store:

```ts
type ToolSession =
  | { kind: "idle" }
  | { kind: "crop"; rect: Rect; dragging: Handle | null }
  | { kind: "shape-edit"; id: AnnotationId; drag: ShapeDrag | null }
  | { kind: "paste"; placement: Placement }
  | …
```

Illegal combinations stop being representable, and each arm is the state
one overlay owns. That is what lets the three big CanvasArea cuts happen
cleanly, in this order: `ShapeEditLayer.tsx` (~750 lines with its overlay,
the biggest single cut), `CropLayer.tsx`, `PastePlacementLayer.tsx`.
`PerspectiveLayer.tsx` is the precedent, already shipped.

**Expected end state:** AppShell ~1,500–1,800, CanvasArea ~1,800. Beyond
that, ADR-002 (tools as registry modules) is the next structural step and it
is blocked on this.

### Track C — the new features

Sequence them after B1. Today a feature costs a prop, a handler and lines in
the return, in a file with zero headroom. After B1+B2 a feature is a store
slice plus a panel that calls `useSession()` and reads its own keys, and
AppShell's diff is near zero.

The test that the refactor worked: **the first new feature after B2 should
not change AppShell.** If it needs a prop through AppShell, the refactor
missed and B2 is not done.

If a feature cannot wait for B1: build it as `features/<name>/` with its own
store from day one and wire only a mount point into AppShell. It then
becomes the first consumer to move onto the context, not another debt.

### Track D — Rust structure, after Track A

Moves, best first, each lowering the file in the same commit:

1. Op-log block (`tiles_*`, recorder, sync, replay, restore, persistence;
   ~820 lines, one feature gate) → `src/oplog_engine.rs` as another
   `#[wasm_bindgen] impl ImageHorseTool` block, the pattern `annotations.rs`,
   `history.rs`, `fonts.rs` already use.
2. Geometry (`resize` / `resize_canvas` / `set_artboard_border` /
   `crop_in_place` / `shrink_to_content`, ~430 lines) → `src/geometry.rs`,
   extracting the duplicated per-layer relayout loop into one
   `relayout_layers(new_w, new_h, off_x, off_y, bg)`.
3. Stateless free functions → `color_parse.rs`, `crop_math.rs`, `webperf.rs`.
4. History block → into `history.rs`.
5. `ops.rs` → `ops/{types,codec,apply,log}.rs` if still worth it after its
   tests leave.

Duplication worth removing, with the caveat that matters:

- "Shift every annotation by (dx, dy)" is verbatim in four places →
  `Layer::shift_annotations(dx, dy)`.
- Straight-alpha source-over exists in six places. **Merge only within a
  family**: the float versions (`stamp.rs`, `transform.rs` paste, `paint.rs`,
  `text.rs`) together, the integer versions (`drawing::blend_pixel`,
  `layer::blend_over`) together. Crossing families changes output by ±1 and
  breaks the replay-parity hashes.
- Two hex parsers disagree: `drawing::parse_hex_color` returns **black** for
  `#fff`, `lib::parse_hex` returns white. Pointing the first at the second is
  a real bug fix for 3/4-digit input to every shape export; it gets its own
  commit and its own test. It also removes the non-ASCII `&hex[0..2]` panic.

Soundness items the panic guardrail cannot see, still open:

- `transform::copy_region` computes `w*h*4` in `u32`; a huge region wraps in
  release and the next write panics.
- `get_pixel_region` with a huge `radius` overflows `side*side*4`. Clamp it.

## The rest of the ledger (2026-09-26 audit, still open)

Cheapest first. Each is a mechanical move or a deletion.

- **Dormant Convex endpoints, ~480 lines with no caller:** `projects.ts`,
  `images.ts`, `layers.ts`, `annotations.ts`, `history.ts`, plus
  `auth.loggedInUser`, `users.saveSettings`, `aiJobs.listForPhoto`. Public
  functions are attack surface; remove the functions first, tables in a later
  deploy.
- **`lib/annotationHitTest.ts`** is a "temporary" port "expiring at v8.56";
  the repo is at v9.1 and `useTextTool` and `useDrawingTools` still import it.
  Build the engine call or rewrite the note.
- **`capMessage`** is byte-identical in `AppShell.tsx` and
  `useImageSession.ts`, hardcodes "24" and says Pro "is coming soon" while the
  tier exists. One copy in `lib/`, numbers from `TIERS`; the wording is a
  product decision.
- **e2e helpers copied per spec:** `blockExternalNetwork` ×12,
  `importFixture` ×7, `watchConsole` ×5, `pickTool` ×5, `waitForCanvas` ×4 →
  `e2e/helpers.ts`. 11 of 12 specs never run in CI.
- Small duplicates with a canonical home: hex→rgb ×4, rgb→hex ×4, byte
  formatting ×3, anchor-click download ×7 (write `lib/downloadBlob`),
  filename-stem regex ×7, `sha256Hex` ×3, `agoText` ×2, inline `clamp` in
  AppShell beside `lib/colorConvert.clamp`.
- 13 `components/*Pane.tsx` are the Settings modal's panes and
  `SubscriptionButton.tsx` is that modal → `features/settings/`. `SettingsTab`
  moves out of `SubscriptionButton.tsx` so `useUIStore` stops importing a
  component (the boundaries rule will insist).
- Tests far from subjects: `lib/entitlement.test.ts`, `lib/shareLimits.test.ts`
  test `convex/`; `lib/autosaveDelay.test.ts`, `lib/dirtyRule.test.ts` test
  `useImageSession`; `hooks/cloudPhotosAllowed.test.ts` tests
  `useEditPersistence`; `lib/exif.test.ts` → `lib/exif/`.
- `FINDINGS-oplog-and-text-0919.md` at the repo root → `docs/archive/`.
- `contractScan.ts` / `engineCallGate.ts` import `node:fs` and are used only
  by tests → `*.testkit.ts` once a second consumer justifies the convention.
- `scripts/engine-rmw-audit.mjs` reports 0 and is cited by a closed item;
  archive. `snapshot-parameter-audit.mjs`, `inert-class-audit.mjs` run
  nowhere; `preview-nocache.py`, `push-all-remotes.sh` are referenced nowhere.
- `docs/File-Map.md` covers 75 of 332 non-test files. Regenerate from the
  tree or shrink to directory level.

## What this plan deliberately does not do

- Rewrite AppShell. Rejected in ADR-042 and still rejected: no reviewable diff.
- Start with B3. Splitting the return before B1–B2 produces four components
  that each need the 77 props.
- Turn the general 900-line rule into an error. A new 901-line file should
  show up in the count, not block the push that created it.
- Add `max-lines` caps to Rust files other than the retired `lib.rs` one.
- Touch `BatchSettings.tsx`. At its cap, not growing.
- Replace Zustand, the router, or Convex's query layer.

## How to tell it is working

Three numbers, all of which only go down, all dated in their config:

- The pinned `max-lines` caps in `eslint.config.mjs`.
- The props count on `<ToolsSidebar` and `<CanvasArea` in
  `scripts/guardrails.sh` (from B0).
- AppShell's diff on the first feature PR after B2. Near zero means done.

If a cap goes a month without moving, this plan has stalled. That is
ADR-042's warning sign, it fired once on 2026-09-26, and the answer was this
rewrite rather than a bigger cap.
