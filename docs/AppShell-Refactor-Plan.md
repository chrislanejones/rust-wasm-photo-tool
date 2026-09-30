# AppShell refactor plan — and the rest of the entropy ledger

Written 2026-09-26. Supersedes the deleted `Entropy-Refactor-Plan.md` for the
part of it that was still open (AppShell, CanvasArea, `lib.rs`), and records
what the 2026-09-26 audit found elsewhere. ADR-042 is the decision this plan
executes; this file is the *how*, with numbers.

## Where things stood on 2026-09-26, before this plan

The `max-lines` ratchet was pinned on 2026-08-27 as a warning. A month later:

| File | Cap (08-27) | Size (09-26) | |
| --- | ---: | ---: | --- |
| `app/src/app/AppShell.tsx` | 3,718 | 3,649 | cap never lowered to match |
| `app/src/features/canvas/CanvasArea.tsx` | 2,909 | 3,025 | **over by 116** |
| `app/src/hooks/useDrawingTools.ts` | 1,173 | 1,360 | **over by 187** |
| `app/src/lib/engine/engineAsyncMigration.contract.test.ts` | 1,015 | 1,136 | **over by 121** |
| `app/src/features/tools/settings/BatchSettings.tsx` | 1,428 | 1,428 | at the cap |
| `src/lib.rs` (guardrails) | 4,808 | 4,763 | cap never lowered |

Three of five over, nothing red, because the rule was `warn` and `pnpm lint`
gates on errors. That is the "early warning sign" ADR-042's pre-mortem named
(the AppShell cap going a month without being lowered), and it fired.

**Done in the same change as this document** (so the plan starts from a green
board, not a promise):

- The pinned caps are now `error` (`eslint.config.mjs`). A push that grows a
  pinned file past its cap fails lint; the fix is to move something out, never
  to raise the number. The general 900-line rule stays `warn`, on purpose.
- The three over-cap files are back under, by pure-function moves:
  `useDrawingTools` 1,360 → 991 (`lib/drawEditState.ts`, `lib/drawPreview.ts`),
  `CanvasArea` 3,025 → 2,802 (`canvasCursor.ts`, `shapeOverlayPath.ts`),
  the contract test 1,136 → 1,015 (`contractScan.ts` — one file walker instead
  of three copies — `engineCallGate.ts`, `enginePortSeam.contract.test.ts`).
- `lib.rs` 4,763 → 4,662 by deleting wasm exports with no caller anywhere
  (below), and its guardrail lowered to match. `rust-panics` 47 → 46, measured.

## AppShell: why it grows, and why more handler extraction will not fix it

ADR-042 (2026-09-02) inventoried the file: 247 named blocks, 34 of them ≥15
lines, totalling 1,255 lines; the best single extraction was 103 lines, 2.7%
of the file; the JSX return is another 993 lines that moving handlers never
touches. Twenty more extraction PRs end near 2,500 lines. That arithmetic has
not changed.

What the file actually is: the composition root, and everything reaches its
children **as props**.

- `<ToolsSidebar>` takes **77** props. `<CanvasArea>` **46** (a 60-field
  `Props`). `<ReviewPanel>` 32. `<TopBar>` 23.
- AppShell reads `useUIStore` 52 times and `useToolStore` 37 times, then
  re-threads those values down as props, each with a `handleXChange` wrapper.
  ADR-042 counted ~213 such glue handlers.
- Engine actions are drilled one callback at a time:
  `onBrightness={stamp.adjustBrightness}` goes AppShell → ToolsSidebar →
  EffectsSettings, and every new adjustment adds a prop at each hop.
- There is **no React context anywhere in `app/src`**. So a new feature has
  nowhere to put shared state except a prop, a handler and a line in the
  1,008-line return. That is the accretion mechanism, and it is why the file
  grew 94 lines *while being dismantled* (entropy report, 2026-07-30).

Zustand is already here (`useUIStore` 74 keys, `useToolStore`, `useGalleryStore`,
`useGuidesStore`, `usePerspectiveStore`, `useTextBoxStore`, `useAnnotationStore`).
The problem is not a missing store; it is that AppShell reads the stores on
the children's behalf.

## The plan

Each phase is its own PR, with the AppShell cap lowered in the same commit.
Sizes after each phase are estimates; the committed caps are measured.

### Phase 0 — scoreboard (done in this change)

Caps to `error`, caps at today's sizes. Add one more counter to
`scripts/guardrails.sh` when Phase 1 starts: the number of props on
`<ToolsSidebar` and `<CanvasArea` inside AppShell (77 and 46 today), so the
thing this plan reduces has its own ratchet and not just a line count.

### Phase 1 — session context (context, not Zustand)

`app/session/SessionContext.tsx` provides the **hook instances AppShell
already owns**: `stamp` (the engine handle from `useCloneStamp`),
`drawingTools`, `pastePlacement`, `canvasRef`. Children call `useSession()`
instead of receiving `onBrightness`, `onFlipH`, `onApplyCrop`, `onSelectLayer`,
… as props.

Context rather than a store because these are functions bound to a hook
instance with refs inside — not serialisable state, and not something a
persisted store should own (ADR-026's "wrong ownership" argument).

Removes: ~30 callback props from ToolsSidebar/CanvasArea and every pass-through
line between AppShell and the leaf that calls them.

Risk to measure first: if the context value changes identity whenever `stamp`'s
*state* changes, every consumer re-renders on every stroke. Mitigation is to
split the value — a stable actions object in one context, and engine **state**
(`layers`, `undoCount`, `levels`, `presets`) read through the
`useSyncExternalStore` path ADR-026 already established. Check `useCloneStamp`'s
callback stability before choosing.

### Phase 2 — consumers read the stores (the Zustand part)

`activeTool`, `toolSettings`, `cropRatio`, `exportFormat`, `quality`, `prefs`,
`photos`/`setPhotos`, `stampSettings`, `shapesMode`, `brushMode`, … already live
in a store. The panel that needs one reads it with a selector; the
`handleXChange` wrapper in AppShell that only calls `set` is deleted, not moved.

This *improves* render granularity — a selector subscribes to one key where a
prop from AppShell re-rendered on any AppShell render.

Rules: each deleted handler is **read**, not pattern-replaced. A handler that
does two things (sets a store key *and* flushes the canvas, or resets another
key) stays in AppShell or moves to a session hook with its reasoning intact.
The exhaustive-deps override in `eslint.config.mjs` explains why store setters
pulled out with `useStore(s => s.setX)` look like missing deps and are not.

Removes: the bulk of the ~213 glue handlers and ~40 more props.

### Phase 3 — split the JSX return

Only viable after 1–2, otherwise the new components need the same 77 props.

- `<CanvasContextMenu>` — the 12 `ContextMenuItem`s and their shortcuts.
- `<ShellDialogs>` — the three `ConfirmDialog`s, `UploadDialog`,
  `ShortcutModal`, `UpdatePrompt`, `ResumeContent`, `Toaster`.
- `<SidebarDock>` — `ToolsSidebar` + `MasterBar` wiring and the
  narrow-window drawer bookkeeping.
- `<Workspace>` — the two `CanvasArea` arms. **Keep the ternary's shape**:
  ADR-024 a11.1 needs the canvas element identity owned by AppShell precisely
  because those arms mount and unmount; the counter must not move into what
  they mount.

Removes: ~700 of the 1,008 JSX lines.

### Expected end state

Roughly **1,500–1,800 lines** — about half. Beyond that, ADR-002 (tools as
registry modules) is the next structural step, and it is blocked on this.

## CanvasArea

Same disease, 46 props. Phases 1–2 apply to it unchanged. After them, the
remaining large moves are the ones the earlier plan named and that are still
valid:

- `ShapeEditLayer.tsx` — the shape/arrow edit drag state + its overlay JSX
  (~750 lines together). Biggest single cut.
- `CropLayer.tsx` — crop handle drag + crop overlay.
- `PastePlacementLayer.tsx` — paste-placement drag + overlay.

`PerspectiveLayer.tsx` is the precedent: same shape, already shipped.

## Rust — `src/lib.rs` and `src/ops.rs`

The audit (2026-09-26) mapped `lib.rs` by topic. Two facts decide the order:

| `lib.rs` block | Lines | Note |
| --- | ---: | --- |
| `layer_tests` + `layer_persistence_tests` | **~1,188 (25%)** | tests, inside the production file |
| `tiles_*` + the whole op-log surface (recorder, sync, replay, restore, persistence) | **~820** | one feature gate, one topic |
| `resize` / `resize_canvas` / `set_artboard_border` + `crop_in_place` / `shrink_to_content` | ~430 | document geometry; two 65-line loops are identical |
| history (undo/redo/labels/jump/delete/clear) | ~160 | `history.rs` already has an impl block |
| `parse_color` / `parse_hex` / component parsers | ~140 | stateless |
| `web_perf_metrics` / `lighthouse_score` / `erf` | ~110 | nothing to do with the engine |
| `constrain_crop_to_ratio` / `compute_aspect_crop` | ~110 | stateless |

Moves, best first, each lowering `librs-lines` in the same commit:

1. **Tests out** → `src/lib_tests.rs` (`#[cfg(test)] mod lib_tests;`). ~1,188
   lines, zero production risk. Do this first.
2. **Op-log block** → `src/oplog_engine.rs` as another
   `#[wasm_bindgen] impl ImageHorseTool` block (the pattern `annotations.rs`,
   `history.rs`, `fonts.rs` already use). ~820 lines.
3. **Geometry** → `src/geometry.rs`, and while moving it extract the
   duplicated per-layer relayout loop (`resize_canvas` / `set_artboard_border`)
   into one `relayout_layers(new_w, new_h, off_x, off_y, bg)`.
4. Stateless free functions → `color_parse.rs`, `crop_math.rs`, `webperf.rs`.
5. History block → into `history.rs`.

`ops.rs` (3,652) is 45% tests: `mod tests` and `mod v2_migration_tests`
(~1,650 lines). Move those to `src/ops_tests.rs` / `src/ops_migration_tests.rs`
first, then `ops/{types,codec,apply,log}.rs` if it is still worth it.

### Duplication worth removing (verified, with the caveat that matters)

- The "shift every annotation by (dx, dy)" block is verbatim in four places
  (`lib.rs` crop_in_place, resize_canvas, set_artboard_border; `layer.rs`
  translate) → `Layer::shift_annotations(dx, dy)`.
- Straight-alpha source-over blending exists in six places. **Only merge
  within a family**: the float versions (`stamp.rs`, `transform.rs` paste,
  `paint.rs`, `text.rs`) with each other, the integer versions
  (`drawing::blend_pixel`, `layer::blend_over`) with each other. Crossing the
  families changes output by ±1 and breaks the replay-parity hashes.
- Two hex parsers disagree: `drawing::parse_hex_color` returns **black** for
  `#fff`, `lib::parse_hex` returns white. Pointing the first at the second
  fixes a real bug for 3/4-digit input to every shape export; it is a
  behaviour change, so it gets its own commit and its own test.
- `layer_content_bbox` was a copy of `tight_bbox` — folded (this change).
- `fn solid(w, h, rgba)` is defined 11 times across test modules; a shared
  `#[cfg(test)] mod test_util` removes them when the tests move out (step 1).

### Soundness items the panic guardrail cannot see

Fixed in this change: `transform::resize_bilinear` trusted caller-supplied
`old_w × old_h` against a JS-supplied buffer; the SIMD path reads through raw
pointers, so a short buffer read past its end, and a zero dimension panicked
in `clamp(0, -1)`. It now refuses both.

Still open, low likelihood, for the next Rust sitting:

- `transform::copy_region` computes `w*h*4` in `u32`; a huge region wraps in
  release and the next write panics. Reachable from `copy_region` /
  `copy_region_composited`.
- `get_pixel_region` with a huge `radius` overflows `side*side*4`. Clamp it.
- `drawing::parse_hex_color` slices `&hex[0..2]` on a `&str`; non-ASCII input
  panics at a char boundary. Goes away with the parser merge above.

### Deleted in this change (no caller in app, tests, benches or fixtures)

`preview_crop`, `cancel_crop_preview`, `apply_crop_from_preview` and the two
`transform` helpers only they used; `stamp_red` (the app uses
`commit_red_stamp`); `get_brush_size`; `begin_draw_stroke`;
`add_polyline_annotation`; `set_annotation_points`; `cancel_move_preview`;
`has_layer_mask`. Each removed from the hand-kept `stamp_tool.d.ts` as well.

Called by tests only, left in place (they need to stay `pub` for `tests/`):
`load_image_artboard` (its doc claiming to be the default import path is stale
— the app calls `load_image` then `set_artboard_border`),
`shape_annotation_count`, `render_with_annotations`, `tonal_preview_active`,
`has_layer_color_overlay`.

Exported to wasm but only ever called from Rust — candidates to demote to a
`pub(crate)` impl to shrink the surface: the five `effects.rs` stroke starters
and region helpers dispatched through `effect_down`/`effect_move`; the four
`paint_dab` / `paint_stab_*`; `get_zoom`.

## The rest of the app — what the 2026-09-26 audit found

Verified by grep, ordered by value. Items marked **done** shipped with this
document; the rest are the queue, cheapest first.

### Fixed in this change

- **`convex/users.ts` `incrementUsage`** was a public `mutation` nothing
  called, taking `amount: v.optional(v.number())` with no sign check — a
  signed-in user could call it with a negative amount and reset their own
  `dailyUsage`, the counter `aiJobs.ts` checks against `TIER_DAILY_CAP`.
  Deleted. **done**
- `useSelectionActions` carried its own copy of `useCanvasCoords` behind an
  `eslint-disable`; it now uses the hook. **done**
- `UserMode` was defined in `components/StatusBar` and imported by
  `lib/tiers.ts`, `lib/photoLimits.ts` and `useUIStore` — a lib module
  depending on a component. Now defined in `lib/tiers.ts`, re-exported from
  StatusBar. **done**
- Live code and docs pointed at documents moved out of the repo on
  2026-09-17 (`vacuous-checks`, `ci-guardrails`, `pen-overlay-async-design`,
  `engine-worker-capture-sweep`, `content-addressed-gc-audit`,
  `share-links-auth-mismatch`) or at `docs/X.md` for files now in
  `docs/archive/`. Fixed in 17 files; the moved-out ones now say so.
  **done**
- `docs/Architecture.md` described `lib/security/imageFirewall.ts`, which
  does not exist, and `lib/exif.ts`, which is now a directory.
  `docs/File-Map.md` listed five deleted files and called the 1,428-line
  `BatchSettings` a "coming-soon panel". Corrected. **done**
- Root `public/` held byte-identical copies of the marketing hero and logo;
  only the September hero is referenced (README). Two files deleted. **done**

### Next, cheap

- **Dormant Convex data model, ~480 lines of public endpoints with no
  caller:** `projects.ts`, `images.ts`, `layers.ts`, `annotations.ts`,
  `history.ts`, plus `auth.loggedInUser`, `users.saveSettings`,
  `aiJobs.listForPhoto`. `schema.ts` itself calls `images` "the unused
  `images` table". Public functions are attack surface; remove the functions
  first, the tables in a later deploy (a deploy step, so not done here).
- **`lib/annotationHitTest.ts` is a "temporary" TS port of the engine's
  hit-test, "expiring at v8.56".** The repo is at v8.90 and it is still
  imported by `useTextTool` and `useDrawingTools`. Either build the engine
  call it was waiting for or rewrite the note; today it is a stale promise.
- **`capMessage`** is byte-identical in `AppShell.tsx` and
  `useImageSession.ts`, hardcodes "24", and says "Pro (100) is coming soon"
  while the paid tier exists. One copy in `lib/`, numbers from `TIERS`, copy
  updated — the wording is a product decision, so it was not changed here.
- **e2e helpers copied per spec:** `blockExternalNetwork` ×12,
  `importFixture` ×7, `watchConsole` ×5, `pickTool` ×5, `waitForCanvas` ×4
  → `e2e/helpers.ts`. Also: 11 of the 12 specs never run in CI (`ci.yml`
  runs `no-sw-default` and `e2e/sw/` only); `pr-sweep-0831` and `qc-v841`
  read as one-off release sweeps and belong in an archive.
- Small duplicates with a canonical home already: hex→rgb ×4
  (`lib/colorConvert.hexToRgba`), rgb→hex ×4 (`useTextTool`'s equals
  `lib/drawEditState.rgbToHex`), byte formatting ×3 (`lib/format.formatBytes`),
  anchor-click download ×7 (write `lib/downloadBlob`), filename-stem regex ×7
  (`ExportPane.baseFileName`), `sha256Hex` ×3, `agoText` ×2, inline `clamp`
  in AppShell beside `lib/colorConvert.clamp`. The ~10 remaining
  client→image coordinate copies are tracked in `PARKING_LOT.md` already.
- `lib/colorConvert.rgbToHsl` / `hslToRgb` and `lib/engine/port.liveEnginePort`
  are production exports only tests use (the dead-exports audit counts test
  files as users). Delete or tag as test-only.
- `contractScan.ts` / `engineCallGate.ts` (new here) import `node:fs` /
  `node:child_process` and are used only by tests. Rename to `*.testkit.ts`
  (precedent: `lib/sync/fakeConvex.testkit.ts`) once there is a second
  consumer to justify the convention.
- `scripts/engine-rmw-audit.mjs` reports 0 and is cited only by a closed
  PARKING_LOT item; archive it. `snapshot-parameter-audit.mjs` and
  `inert-class-audit.mjs` run nowhere — add to guardrails or list as manual
  in `docs/CI.md`. `preview-nocache.py` and `push-all-remotes.sh` are
  referenced nowhere.

### Next, organisation (each a mechanical move, no behaviour)

- **`app/src/hooks` is 38 hooks.** The engine core belongs there
  (`useEngineCore`, `useCloneStamp` — misnamed, its header says it is the
  engine facade with 17 importers — `useLayers`, `useExport`, `useHistory`,
  `useTransforms`, `useCanvasCoords`, `useEffectiveTool`). The tool-specific
  ones belong under `features/tools/<tool>/`: drawing/shapes (`useDrawingTools`,
  `useShapeZOrderMenu`), text (`useTextTool`, `useRecentTexts`,
  `useEngineFaces`), `usePerspectiveTool` (one importer, `PerspectiveLayer`),
  paint (`usePaintTool`, `useBrushPreview`), `useMagicEraserTool`, stamp
  (`useRedStampTool`, `useEmojiTool`), `useMoveLayerTool`,
  `usePastePlacementTool`, color (`useColorPicker`, `useUserColors`),
  `useAIJob`, `useAutoCompress`. Diagnostics (`useDiagnostics`,
  `useDiagnosticsSampler`, the four diagnostics components,
  `subsystemColors.ts`) → `features/diagnostics/`.
- `hooks/stamp_tool.d.ts` is the hand-kept wasm API declaration, not a hook
  → `lib/engine/`. Update the path in `scripts/engine-call-audit.mjs`,
  `engine-rmw-audit.mjs`, `snapshot-parameter-audit.mjs` and the contract test.
- 13 `components/*Pane.tsx` are the Settings modal's panes and
  `SubscriptionButton.tsx` is really that modal → `features/settings/`.
- `SettingsTab` lives in `SubscriptionButton.tsx` and `useUIStore` imports it —
  same inversion as `UserMode`, same fix.
- Tests far from subjects: `lib/entitlement.test.ts`, `lib/shareLimits.test.ts`
  test `convex/`; `lib/autosaveDelay.test.ts`, `lib/dirtyRule.test.ts` test
  `useImageSession`; `hooks/cloudPhotosAllowed.test.ts` tests
  `useEditPersistence`; `lib/exif.test.ts` belongs in `lib/exif/`.
- `FINDINGS-oplog-and-text-0919.md` sits at the repo root → `docs/archive/`
  (update the citation in `lib/textBoxSurvivesReload.test.ts`).
- `docs/File-Map.md` covers 75 of 332 non-test files (none of `app/session/`,
  `lib/engine`, `lib/sync`, four of six stores). Regenerate it from the tree
  or shrink it to directory level; a hand-kept file map of 332 files will
  always be wrong.

### Checked and fine

Every store key is both read and set; every store action has an external
caller; every runtime `ih_*` flag read is registered in `lib/featureFlags.ts`;
no `@ts-ignore`, no `.skip`/`.only`; the disabled UI (S3/R2 connect, AI
Generate) is deliberate and says so; `dead-exports-audit` reports 0.

## What this plan deliberately does not do

- Turn the general 900-line rule into an error. A new 901-line file should
  show up in the count, not block the push that created it.
- Add `max-lines` caps to Rust files other than `lib.rs`. `ops.rs`,
  `annotations.rs` and `layer.rs` are large; a cap is a separate decision.
- Touch `BatchSettings.tsx`. At its cap, not growing.
- Rewrite AppShell. Rejected in ADR-042 and still rejected: no reviewable diff.

## How to tell it is working

The pinned caps in `eslint.config.mjs` only ever go down, and the date next to
each one is recent. If a cap goes a month without moving, this plan has
stalled — that is ADR-042's warning sign, and it is the one that fired once
already.
