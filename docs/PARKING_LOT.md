# Parking Lot

Adjacent problems noticed mid-session that stay OUT of that session's
diff (global CLAUDE.md hard rule 4). One session = one target; these
wait their turn.

## OPEN — #56: the Netlify UI holds a stale copy of the build command (2026-09-04)

Read via `netlify api getSite`. `build_settings.cmd` in the Netlify UI is the
**pre-ADR-038** command:

| | Netlify UI setting | `netlify.toml` |
|---|---|---|
| wasm features | **none passed** | `--features tiles,patchmatch` |
| Rust toolchain | `--default-toolchain stable` | `none` — the pin file decides |
| wasm-pack | unpinned `cargo install` | `--version 0.15.0 --locked` |
| install | `pnpm ci` (not a pnpm command) | `pnpm install` |
| build | `cd app && pnpm run build` | `pnpm --filter stamp-tool build` |

**`netlify.toml` wins today, and production is correct.** Evidence rather than
precedence-docs: the live wasm is **816,324 B**, a measured featureless build
was **723,755 B**, the sentinel band is 780,000–850,000 B (ADR-037), and the
"Deploy sentinel (live prod engine)" CI job is green.

So it is a loaded gun, not a live fire. It fires if `netlify.toml` is renamed,
moved under a `base` subdirectory Netlify cannot see, or if anyone edits the
command in the UI — and the failure mode is the **v7.36–v7.45 featureless-wasm
bug**, which shipped for ten releases without anyone noticing.

**Fix: clear the UI command** so `netlify.toml` is the only source. That is a
production build-settings change, so it wants a human hand:

```
netlify api updateSite --data '{"site_id":"<id>","build_settings":{"cmd":""}}'
```

Or clear it in Site configuration → Build & deploy → Build command.

Same shape as the `wasm-pack: latest` drift that cost a night: two sources of
truth for one build, and the invisible one is the one that rots.

## OPEN — no Content-Security-Policy on either site (2026-09-03)

Found by the night-0902 security pass. Live responses from **both** the app and
the marketing site carry exactly one security header:

| Header | App | Marketing |
|---|---|---|
| `strict-transport-security` | ✅ present | ✅ present |
| `content-security-policy` | **absent** | **absent** |
| `x-frame-options` | **absent** | **absent** |
| `x-content-type-options` | **absent** | **absent** |
| `referrer-policy` | **absent** | **absent** |
| `permissions-policy` | **absent** | **absent** |

There is no `[[headers]]` block in `netlify.toml` and none in `vercel.json`, so
this is absence rather than misconfiguration.

**Not a midnight patch.** A CSP for this app has to allow things most templates
forbid: `'wasm-unsafe-eval'` for the engine, `blob:` and `worker-src` for the
engine and codec workers, plus the Clerk and Convex origins. Getting it wrong
breaks image loading or auth in ways that only show up in production. It wants
an ADR-sized think and a deploy-preview check, not a guess.

Everything else in that pass came back clean: **0 secret patterns** in the
shipped bundle across 9 checks, `.env*` gitignored and untracked, no
`dangerouslySetInnerHTML`, no `target="_blank"` without `noopener`, and the 12
npm advisories are all **devDependencies** that never reach a user.

## CLOSED at the engine level — #72 "paint lands on every layer" (2026-09-03)

Three sessions could not reproduce this. It is now driven and measured, and the
engine is **correctly scoped**.

Reached the engine through the React fiber tree (`stampToolRef`) on the running
app and ran the sequence directly, hashing every layer's PNG before and after:

| Step | Result |
|---|---|
| Start | 2 layers, active **id 1 (Photo)** |
| `select_all()` + `selection_to_new_layer(true)` | 3 layers, active **id 3** |
| Engine vs Layers panel | **agree** — no sync bug |
| `paint_down` → 10 × `paint_move` → `paint_up` | — |
| **Layers changed by the stroke** | **exactly one — the active layer** |

```
idx0 Canvas   644f4b5b4160e3d3 -> 644f4b5b4160e3d3   unchanged
idx1 Photo    644f4b5b4160e3d3 -> 644f4b5b4160e3d3   unchanged
idx2 Layer 3  8d184920ad379c8d -> c15e7e57e1dfc805   CHANGED (active)
```

Three independent confirmations now agree: the 08-28 per-layer hashing, the
code (`paint.rs:459` writes `&mut self.layers[active].buf.data`, and
`layer.rs:803` moves `self.active` on insert), and this live drive.

**So what was seen is compositing, not routing.** `selection_to_new_layer`
clones the ENTIRE source layer and clears outside the selection
(`selection.rs:605`), so the new layer is a **full-canvas buffer above the
source** — a stroke on it composites over every layer below and reads as "it
hit everything".

⚠️ **Caveat:** driven with `select_all()`, not a magic-wand partial selection —
the worker proxy exposes no rect/wand select. A partial selection still yields
a full-canvas layer on top, so the conclusion holds, but the one-action human
check is still worth doing: paint after a cut, toggle the new layer off, and
confirm the stroke goes with it.

**What remains is a UX question, not a bug**: should cut-to-layer produce a
full-canvas layer? Reword #72 accordingly rather than hunting for a pixel bug
that measurement says is not there.

### Two probe traps, so the next person does not lose the time

- `begin_stroke` / `continue_stroke` / `end_stroke` is the **clone stamp**, not
  the paint brush. Used for a paint test it reports "no layer changed" and
  looks like a clean pass.
- The brush is
  `paint_down(x, y, size, color: &str, opacity, hardness, stab: &str)`. A wrong
  signature throws **`memory access out of bounds`** from the worker, not a
  type error — it looks like an engine crash and is a caller mistake.
- The engine handle from the fiber tree is an **async proxy**: every method
  returns a Promise. Forgetting `await` yields `{}` and an empty method list,
  which reads as "the engine is missing".

## OPEN — the layer rows want listbox semantics, and cannot have them cheaply (2026-09-01)

Found by the #10 pass, which fixed what a leaf could fix and stopped there.
`ReviewPanel.tsx` renders each layer as `<li role="button" tabIndex={0}>`.
#10 added `aria-current` so the active layer is announced at all — before, it
was a CSS class and nothing else.

The richer answer is `role="listbox"` on the container and `role="option"` on
the rows, which is what `aria-selected` actually requires. Two things block it,
and neither is a leaf:

| Blocker | Why it stops here |
|---|---|
| Roving tabindex + arrow-key navigation | a listbox that does not answer arrow keys is worse than no listbox — it promises a keyboard model it does not have |
| `role="option"` forbids interactive descendants | **each row carries six buttons** — visibility, rename, up, down, merge, duplicate, delete |

The second is the harder one: it is not extra work, it is a different row
design. Every row button would have to move out of the row — probably into the
Layers tool panel, where v8.38 already moved the mask controls for the same
reason. That is a UI decision, not an accessibility patch.

Until then `role="group"` is on the container, honestly: the rows are buttons,
so the implicit `list` role was claiming `listitem` children it never had.

## OPEN — this repo cannot test a component, so no panel a11y is pinned (2026-09-01)

`@testing-library/*` is **not a dependency** and there are zero component tests
in `app/src` — every one of the 53 test files is a pure-module test. So the
#10/#64 attributes just shipped with no assertion behind them, and the same
was true of #78 in August, which was filed as a coverage gap for exactly this
reason and has not moved since.

Adding React Testing Library is a new dependency and an ADR trigger, so it
cannot ride along on an accessibility fix. It is worth a sitting of its own:
the layer panel, the tool panels and the master bar are all now carrying
a11y attributes that nothing can regress-test, and the count only grows.

Playwright can reach these — the `imagehorse-qc` spec already drives the real
DOM — so the cheaper path may be an e2e assertion rather than a unit harness.
Either way it is a decision, not a chore.

## OPEN — the marketing architecture page promises a service worker that does not ship (2026-09-01)

Found by the v8.62 docs catch-up, which was scoped to flag marketing drift and
not touch it — public copy is a human call. Four findings on
`marketing/src/pages/Architecture.tsx`:

| Line | Says | Reality at v8.61 |
|---|---|---|
| 134-135 (**visible copy**) | "a service worker that precaches the shell and the WASM binary" | never on in a shipped build — `__IH_SW_MODE__` defaults `"off"` |
| 83 (source comment) | "There is no service worker in a shipped build" | **correct** — and it sits 50 lines above the copy that contradicts it |
| 113 | "Codec worker — encode · thumbnail · OffscreenCanvas" | the **engine worker** owns the OffscreenCanvas, not the codec worker |
| 115 | "rayon worker pool — planned, gated on COOP/COEP" | measured and **rejected** (8-31× slower), preserved as tag `negative-result/rayon-wavefront` |
| — | no mention of the engine worker anywhere | it has been the default engine since v8.32 |

The first row is the one that matters: a visitor reads a shipped feature that
does not exist, and somebody already left a comment on the same page warning
about exactly this failure mode. The last row is the bigger omission — the
page describes the architecture and is missing its largest structural fact.

## OPEN — 13 broken in-page anchors in docs/archive/Refactor-Playbook.md (2026-09-01)

Its table of contents links `#0-the-one-rule`, `#2-color--theme-tokens` and
eleven more, but the headings carry `[generic]` / `[IH conventions]` suffixes
that GitHub folds into the slug — so every TOC link lands nowhere. Pre-existing,
and the file is archived (`docs/archive/README.md`: "Nothing in here is a
reference"), so the v8.62 link sweep left it alone. Fix is mechanical: either
strip the suffixes from the headings or write the anchors to match them.

The sweep itself is clean — 181 relative links across 80 tracked `.md` files,
0 broken. This is anchors only, in one archived file.

## OPEN — a fresh text commit with the shadow ON is still two undo steps (2026-08-28)

Found by the shapes user-testing session, via the QC text spec going red the
moment Ctrl+Z stopped being double-bound. Measured with `history_labels()` on
the production build:

| Commit | Before | After this session |
|---|---|---|
| fresh text, shadow **off** (the default) | `Add Text` + phantom `Text Shadow` = **2** | **1** |
| fresh text, shadow **on** | `Add Text` + `Text Shadow` = **2** | still **2** |

The off case was a comparison bug (`set_text_shadow` compared dormant colour /
alpha / offset while the shadow was invisible on both sides) and is fixed in
the engine. The on case is structural: `commitText` is `add_text_annotation`
followed by three setters, each of which is its own snap, and the op log's
undo steps back ONE op per snapshot ("one op ↔ one snapshot" lockstep in
`try_oplog_undo`). Folding the snaps into one is not enough — the ops would
still be two, and the second op-log undo would pop a snapshot belonging to an
earlier action.

The real fix is an engine-side compound: `add_text_annotation` taking the
shadow (and box) params, OR a `begin/end_compound` that also defers the
`oplog_sync_annotations` diff so ONE `TextAdd` op carries the whole thing.
Either changes the recorded op stream, so it is a `tiles` replay-parity
change, not a quick one. Filed, not built.

## OPEN — Color Overlay does not survive a reload (2026-08-28)

The Layers → Color Overlay style shipped session-lived, exactly like the layer
MASK it sits under: `push_restored_layer` sets both `mask: None` and
`overlay: None`, because the layer archive carries pixels + annotations only.
Undo/redo DO reverse it (the style rides on `Layer`'s `Clone` into every
snapshot) — it is only the reload boundary that drops it.

| Boundary | Mask | Color Overlay |
|---|---|---|
| undo / redo | survives | **survives** |
| merge down / flatten | baked | **baked** |
| PNG/JPEG export + thumbnail | honoured | **honoured** |
| **OpenRaster (.ora) per-layer export** | **lost** | **lost** |
| reload | **lost** | **lost** |

The `.ora` row is the same root cause as the reload row: `get_layer_png(i)`
returns `layer.buf` — raw pixels — while the flat composite paths all route
through `render_layer`, which applies mask then overlay. Verified in code
2026-08-28, not inferred. It is pre-existing behaviour for masks; Color Overlay
simply inherits it.

Not fixed here: persisting either one is an IndexedDB schema change, so it goes
through the `dexie-migration` skill, and it should carry BOTH in one migration
rather than adding a second half-persisted style. Filed, not built.

## OPEN — three `max-lines` pins are now stale by 5, 9 and 32 lines (2026-08-28)

Color Overlay pushed two pinned files past their 2026-08-27 baselines:

| File | Pin | Now | Over by | Why |
|---|---|---|---|---|
| `app/src/app/AppShell.tsx` | 3806 | 3811 | **+5** | the `layerOverlay={{…}}` prop block at the composition root |
| `…/engineAsyncMigration.contract.test.ts` | 1015 | 1024 | **+9** | that gate REQUIRES a documented comment when its count moves (122 → 125) |
| `app/src/hooks/useDrawingTools.ts` | 1173 | 1205 | **+32** | the shapes key handler grew Delete/Backspace and the pending-aware Ctrl+Z (same day, second session) — it is the hook that owns the pending edit, so this is where they go |

Both are `warn`, and the lint gate is errors-only, so nothing is blocked. **Do
NOT raise either pin** — that is the one move the ratchet exists to prevent.
They come back under on their own when AppShell's next extraction lands and the
pin is lowered in that commit.

For contrast, the Rust twin went the right way in this session:
`src/lib.rs` 5213 → **5183** (`Layer::from_snapshot_pixels` collapsed the two
hand-built snapshot layers), and `scripts/guardrails.sh` was lowered to match.

## CLOSED before it was filed — `oplog_v3_resume` `required-features` (2026-08-17)

Found independently on the perspective branch and on master, the same day.
`tests/oplog_v3_resume.rs` had no `[[test]]` block, so `cargo clippy
--all-targets` (no features — what the pre-push hook runs) tried to compile it
featureless, where `stamp_tool::ops` does not exist.

| Command | Before the fix |
|---|---|
| `cargo test --features tiles,patchmatch` | passed |
| `cargo clippy --all-targets` (= the hook) | **failed to compile** |

**Already fixed in v8.41 (`261f661`) — the push hook caught it there first.**
Recorded only because the two fixes were byte-identical in the block and
differed only in comment, and the perspective branch took master's. Nothing
outstanding.

## OPEN — the sub-mode axis has a THIRD hand-written copy (2026-08-17)

Found while wiring Perspective's routing. `routeState.ts`'s `modeOfActiveTool`
is a `switch` mapping each ToolType to the store field holding its sub-mode —
which `toolModes.ts`'s `MODE_ACCESS` already knows, exactly and reactively.

A tool missing from that switch does not fail loudly: it returns `undefined`,
and `subToolForToolMode` then falls back to the group's FIRST live sub-tool. So
`#/edit/perspective` silently lit Distort, and the hash round-trip rewrote
itself. Caught by `hash -> state -> hash is identity for every live sub-tool`,
which is the only reason it did not ship.

Derive it from `MODE_ACCESS` instead. Not done here: it touches every tool's
routing and this session was scoped to one tool.

## OPEN — Perspective does not warp SHAPE annotations (2026-08-17)

Named in ADR-034, deliberately not built. Text warps non-destructively; shapes
do not. A homography maps straight lines to straight lines, so a rect's four
mapped corners are exact and lines/arrows/polylines/pen paths are just their
control points — but a circle becomes a conic needing polygon approximation,
and the shape render path has no tile cache to warp the way text does.

## OPEN — a dragged text box does not survive a reload (2026-08-14, PRE-EXISTING)

Found while smoke-testing v8.41's box height; **it is v8.40's bug, not v8.41's,
and that is measured rather than assumed.**

| Build | before reload | after reload |
|---|---|---|
| master, v8.40 code, untouched | `wrap_width` **340** | **0** |
| v8.41 (this work) | `wrap_width` 178, `box_height` 365 | **0 / 0** |

The control build is what makes this reportable: master was stashed to, rebuilt,
served on its own port, and driven through the same steps. v8.40's headline
feature — drag the box, the words rearrange — is undone by a refresh.

**Where it is NOT.** The engine and the codec both carry the box correctly:
`tests/oplog_v3_resume.rs` drives the real `oplog_restore` entry point and gets
`wrap_width` and `box_height` back, including from bytes written by a v3 writer.
So the loss is above the engine, in which resume path actually runs.

**The likely mechanism, unconfirmed.** `useImageSession` prefers
`restoreFromOplog` and falls through to the archive path (`loadFromSaved` →
`restoreLayerStack` → `restore_text_annotation`) when it returns false. That
fallback hardcodes **0** for both box axes — layer JSON has never carried them,
which is filed as ADR-024-F7. On the origin measured, `opLogs` and `keyframes`
were both EMPTY, so the archive path is the one that ran. That is consistent
with the observation but does not prove it is the only way to get here; the next
session should instrument which branch fires before fixing either.

⚠️ Note the trap this nearly set: driving the v8.41 build against a
master-written database looked like a migration fixture and was not one — with
no op log in that origin, only the archive path was exercised. **An absent
fixture reads exactly like a passing one.**

## The v8.34 brush fix was never applied to the other brushes (2026-08-14) — clone stamp AND blur NOW FIXED

Diagnosed during the shapes/text-box session ("all of the brushes are still too
slow on the live website"); the clone stamp and then blur/pixelate/redact were
fixed the same day at Chris's request.

v8.34 fixed the paint brush by changing the INPUT pipeline, not the engine: at
most one engine call in flight, newest-position-wins on the unsent ones, and one
flush per animation frame. That took a 1.4 s stroke from **17.0 s** of banked
ink lag to **0.26 s**. The cause it removed was structural, not specific to
paint — the pre-worker engine BLOCKED the main thread, so the browser coalesced
pointer events down to the engine's service rate for free; a worker yields
instead, so a real mouse's 120–420 Hz now reaches the port unthrottled and the
FIFO fills with obsolete cursor positions.

| Tool | In-flight gate | Newest-wins | Flush per rAF | State |
|---|---|---|---|---|
| Paint / eraser / mask (`usePaintTool`) | yes | yes | yes | **fixed v8.34**, migrated onto `lib/strokeCoalescer.ts` 2026-08-17 |
| Clone stamp (`useCloneStamp`) | yes | yes | yes | **✅ FIXED v8.41** via `lib/strokeCoalescer.ts` |
| Blur / pixelate / redact (`AppShell.blurMove`) | yes | yes | yes | **✅ FIXED v8.41** via `lib/strokeCoalescer.ts` |

**The shared scheduler now EXISTS**: `app/src/lib/strokeCoalescer.ts`, the
v8.34 trio extracted as a plain testable factory (`strokeCoalescer.test.ts`
pins one-in-flight, newest-wins, one-flush-per-rAF, the hidden-tab rAF-gate
reset, and recovery from a rejected/timed-out port call). The clone stamp is
its first consumer.

**Clone stamp fix, measured** (production builds, served on fresh ports, 600
`dispatchEvent` mousemoves spin-paced at 420 Hz over a 1,426 ms stroke, drain =
time for a call posted at mouseup to clear the port FIFO):

| Brush | Before drain | After drain |
|---|---|---|
| 200 px | **10,754 ms** | **142 ms** |
| 20 px (default) | 165 ms | — (bounded by construction) |

**Blur fix, measured** (same probe, default 32 px size — the panel's max is
128, so the before-number scales up from here):

| Metric | Before | After |
|---|---|---|
| Drain after a 1,426 ms stroke | **2,509 ms** | **492 ms** |
| Scaling | linear with stroke length | **constant** stroke-end cost |

The queue only grows when per-move cost × event rate exceeds 100% duty — clone
at the default 20 px costs ~0.27 ms/move and kept up, at 200 px ~20 ms/move and
banked ~11 s; blur at its default 32 px already costs ~6.6 ms/move (275% duty),
which is why it lagged at EVERY size. Blur's after-residual (~0.5 s) is one
in-flight move + the stroke-end flush/sync — bounded, not accumulating. The old
handler also flushed per changed move with NO rAF gate, so its before-number
includes that traffic. `blurUp` additionally gained the stroke-end direct flush
paint and clone both have (op-log publish + the hidden-tab rAF latch).
Engine-verified for both fixes: the coalesced stroke changes the composite
hash, history label lands ("Stamp 1" / "Blur"), undo removes it, redo restores
byte-exactly. Pixelate and redact share blurMove (mode picked at `effect_down`),
so all three modes are covered by the one fix.

**Paint migration — ✅ DONE (2026-08-17, post-v8.41).** `usePaintTool` now
routes through `lib/strokeCoalescer.ts`; the inline original is deleted, so
there is no second implementation left to drift. All three stroke consumers
(paint, clone stamp, blur/pixelate/redact) are on the one module.

Re-measured with the 420 Hz flood, as this entry required — 600 synthetic
mousemoves spin-paced at 420 Hz over a 1,429 ms stroke, production build,
drain = mouseup → Undo goes live:

| Build | Drain |
|---|---|
| inline original (control, stashed migration) | 21 ms |
| shared coalescer (3 runs) | 13 / 30 / 33 ms |

**Indistinguishable within run-to-run variance — read this as "no regression",
not as an improvement.** The point of the number is that it is still in the
tens of milliseconds and bounded, against paint's 17,000 ms pre-v8.34 history.
Control-tested by stashing the migration and re-measuring the same build shape,
not by comparing against a remembered figure.

**Still owed:** nothing on the brush arc.

⚠️ Probe lessons, hard-won twice now: verify against the SERVED production
bundle; drive floods with `dispatchEvent` at hardware rates (`page.mouse` paces
~25 Hz and reports everything clean); and **a hidden tab throttles `setTimeout`
to ~1/s — pace probes with spin-waits or MessageChannel yields, never timers**,
or the flood itself crawls and reads as a >30 s backlog that does not exist.

## ADR-024 — found during a12.3 gate 1 (2026-08-13, v8.28)

- **✅ CLOSED in v8.30 — the mid-session kill-switch gap, and it was worse than
  this entry said.** The entry (written v8.28) recorded that flipping
  `ih_engine_worker=0` mid-session made "the blit die with `IndexSizeError`".
  Re-measured on the production build before fixing: the throw happens **inside
  render**, so React unmounted the entire tree — **`#root` empty, 0 children,
  the whole app gone**, not a blank canvas. The reverse flip (`=1` on a local
  document) posted into a null port and froze the canvas.

  Root cause was one line: `blitLiveEngine` believed the FLAG, which can change
  at any moment, about a document whose ENGINE cannot follow it. It now branches
  on `livePort` — where the engine actually lives — which cannot be stale
  because it is the thing that owns the engine. Both directions are safe, the
  three comments that overclaimed are corrected, and
  `canvasSurfaceKey.contract.test.ts` pins it (mutation-tested: restoring the
  flag branch turns both new guards red).

  **The honest behaviour, now stated everywhere:** `ih_engine_worker` takes
  effect on the NEXT LOAD, like `ih_tiles_flush` / `ih_oplog_undo` /
  `ih_patchmatch`. A mid-session flip is inert — the app keeps working, the
  canvas stops updating until reload. Verified in the browser both directions.

- **ADR-024-F1 — Live mode migration, the feature that was NOT built (successor
  to the above).** Numbered 2026-08-13 so it stops living only in a `port.ts`
  comment. Making a flip take effect immediately means moving the document
  between threads: pull the composite (or working copy) and the op log out of
  the worker, construct a local `Tool`, load the pixels, restore the log, and
  swap `toolRef.current` atomically. `capture_state()` and `oplog_encoded_ops`
  already exist and do most of it. This is a genuine feature with its own
  session, and ⚠️ **if any part of it starts to look like a persisted-format
  change, it needs an ADR plus the `dexie-migration` skill** — not a night job.

- **ADR-024-F2 — the cheaper alternative, worth considering before F1: make the
  mode a per-tab CONSTANT.** Read `ih_engine_worker` once and have
  `createLiveEngine`, `canvasSurfaceKey` and the canvas helpers all use that
  snapshot. A mid-session flip then does literally nothing until reload — true
  by construction rather than by careful branching, and it retires a11.3's
  keyed remount as unnecessary. Rejected for v8.30 only because it changes what
  the existing flag-driven tests can drive (they stub `localStorage` after
  import) and reverses an a11.3 design decision, which deserves an ADR note
  rather than a one-commit night.

- **Eight contract tests anchor their source-walk on `process.cwd()`, so they
  read NOTHING when the suite is launched from the repo root.** Measured:

  | launched from | `process.cwd()` | files the walk sees |
  |---|---|---|
  | repo root (`pnpm test`) | repo root | **0** |
  | `app/` | `app` | 236 |

  `<repo>/src` is the Rust crate and contains no `.ts`, so `walk()` returns an
  empty list and every assertion over it passes vacuously — no error, no skip.
  Affected: `engineAsyncMigration`, `canvasSurfaceKey`, `canvasGeneration`,
  `engineOwnership`, `canvasIdentity`, `textMetricsCache`, `batchExportPlan`,
  `toolSurfaces`, `deletePhotoOriginals`.

  ⚠️ **This did not mask anything today** — the suite passes identically from
  either directory (525 tests), and none of these guards models the worker's
  wire format, so none of them could have caught the v8.28 defects. It is a
  latent weakness, not the cause of anything. The fix is one line per file:
  anchor on `fileURLToPath(new URL(".", import.meta.url))` the way
  `captureMarshal.contract.test.ts` now does.

## Engine

- **Layers clip to canvas bounds at commit.** Layer buffers are
  canvas-sized (`Layer::new(id, name, self.width, self.height)`), so
  `commit_paste_preview` → `paste_region` permanently discards pixels
  outside the canvas. The paste-placement flow now fit-scales oversized
  pastes *before* commit (both import paths), but once committed, any
  content scaled/moved beyond the canvas edge is unrecoverable —
  "Resize Layer" only re-seeds from the clipped buffer. True fix:
  per-layer bounds + offset in the engine (Photoshop-style), which
  touches composite, masks, history, and persistence. Big change —
  needs its own session (Silas + a roadmap entry, see
  docs/Engine-Roadmap.md).

## ADR-024 — a12.3 gate 1, and why it cannot be automated here

- **✅ "Loading your workspace…" is SOLVED — and it was never a bug.**
  A **backgrounded tab gets ZERO `requestAnimationFrame` callbacks**
  (measured: 0 frames in 3,856 ms with `document.hidden === true`), and
  framer-motion drives every entrance and exit off rAF. So they all freeze
  mid-flight: the splash's exit never completes and the node stays mounted,
  and the tool sidebar's entrance parks it **off-screen at `left: -44`** —
  which is why automated clicks on the tool rail silently miss.
  Instrumenting all six steps of AppShell's boot showed it completing in
  ~2 s, `setBooting(false)` included, while the splash was still on screen.
  It is not sign-in, not Convex, not gallery size, not storage; those were
  all guesses and all wrong.

- **a12.3 gate 1 therefore cannot be run from an automated hidden tab.**
  The only thing that remounts the canvas is crossing the **Batch** boundary
  (a11.1 measured this), that needs a real click on the tool rail, and the
  rail is off-screen. Three routes were tried and all failed for this one
  reason: hash routing (`#/batch` does not change `activeTool`), a direct
  click, and flipping the flag to force a11.3's keyed remount.
  **What it needs: a foregrounded window.** Everything else about gate 1 is
  ready — the rejection now REPORTS rather than returning silently, and a
  contract test requires both the guard and the report.

## ADR-024 — leftovers from the conversion arc

- **`syncOplog` is nine engine reads per flush, for a diagnostics panel.**
  `flushToCanvas` calls it on every flush and `registerOplogStats` stores
  the result in a module variable that only `useDiagnostics` reads. Behind
  the worker that is nine round trips per frame — roughly 0.9 ms of a
  16.7 ms budget spent answering a question nobody is looking at unless the
  diagnostics window is open. Converted faithfully in v8.22 and deliberately
  NOT redesigned; the honest options each change behaviour: one
  `capture_oplog_stats()` on the Rust side (the a3/a5 atomic-capture
  pattern), throttling to a few Hz, or only running it while the panel is
  open. **Read Stage 5's frame timeline with this in mind rather than
  blaming the architecture.** `tryTilesFlush` has the same shape at 3 reads.

## ADR-024 — a10 blocks a12, and the ADR said otherwise

- **a10 (the hot-path bucket) is a PREREQUISITE for turning
  `ih_engine_worker` on, and ADR-024 line 84 claimed Stage 4 was "gated on
  Stage 3.5 alone".** Found 2026-08-12 opening a12; the ADR is corrected in
  place. The migration ratchet counts value-consumed sites only, so a gate
  at its floor of 5 says nothing about category C — and **15 of its 18 sites
  consume a value synchronously.** Flip the flag today and `lasso_active()`
  returns a Promise (`!Promise` is false, the guard stops firing),
  `get_pixel_region` is indexed and yields `undefined`, and
  `if (changed)` in `usePaintTool` is true on every pointermove.
  a12.1's wiring can be built behind the flag but **cannot be verified** —
  all three a12.3 gates need the flag ON, and the cross-implementation
  matrix dies on the first lasso drag.
  **Latency is NOT the objection** — `docs/engine-worker-feasibility.md`
  measured a 0.100 ms median round trip (0.6% of a frame) and says so in its
  headline. The real work is that an async per-move handler can overlap
  itself (the v8.19 `finish()` shape), plus three sites needing restructure
  rather than an await: `get_pixel_region` (indexed), `usePaintTool`'s
  ternary, and `isLogTrustworthy` (a second already-async caller, the v8.2
  finding).

## UI

- ~~**PenOverlay needs a pending state — the last step of ADR-024 Stage
  3.5.**~~ **DONE, v8.19.** The gate reached its floor of 5 and Stage 3.5
  is complete; Stage 4 is no longer gated on anything but the decision to
  flip `ih_engine_worker`. Built as designed
  (`docs/pen-overlay-async-design.md`, now marked BUILT with the three
  deviations and the gesture results). Two things worth carrying forward:
  the guards live in `features/canvas/penPath.ts` because they needed
  tests and this repo has no component-render harness; and
  `CanvasArea`'s `onPenCommit` was typed `=> void`, which would have
  swallowed the Promise **without tsc complaining** — a `void` return
  slot is not proof that nothing is consumed.

- **No-change re-edit commit pushes a redundant undo snapshot — now
  visible on the pen too.** Holding `Enter` on a selected pen path adds
  one `Edit Pen Path` step per repeat (12 presses → 1 `Add` + 11
  `Edit`). Pre-existing and the same root cause as the text-annotation
  entry further down: the commit path always snapshots instead of
  skipping when nothing changed. Cosmetic undo-depth noise, not data
  loss; measured during v8.19's browser run.

- **Three modal primitives** (`ui/dialog`, `Modal`, `SmallDialog`) —
  converging on `ui/dialog`. (Carried over from CLAUDE.md known debt;
  v7.1 did the first convergence pass.)
- **Idle "Paused to save power" dialog can stack under another open
  modal** (e.g. the import-choice dialog). Its backdrop sits above the
  lower modal's buttons while its own Continue button is aria-hidden
  behind the top modal. A human can still click Continue, but it's
  awkward and breaks a11y tooling/automation. Consider suppressing the
  idle pause while any modal is open, or always rendering it topmost.

## From the 2026-07-10→11 night run (tile-wiring + persistent-undo, ih-wire)

- **Suppress snapshot pushes while the op log is healthy** — the actual
  memory win of op-log undo; needs dogfooding confidence first (ADR-013
  consequence).
- **Ops for pixelate/redact dabs + clone stamp** — currently unrecordable;
  one of them breaks the log for the session (by design, hash fallback).
- **Multi-layer op model** — op-log undo/persistence is single-layer only
  (user's scope call); default imports are 2-layer (canvas+photo), so the
  log only activates after Remove Canvas or for Blank Canvas docs. Decide:
  treat canvas+photo as in-scope, auto-flatten, or accept.
- **Keyframe GC** — interior keyframes accumulate on disk per photo
  (bounded by rewrite-on-branch, but ADR-006's pre-mortem is about exactly
  this). Refcount or idle sweep once tiles/branches share blobs.
- **docs/architecture.md doesn't exist** — the night spec assumed one;
  create it or point the persistence docs elsewhere.
- **Op Log diagnostics gauge lags one flush** (stats read at flush;
  paint_up records after the stroke's last flush). Cosmetic.
- **dexie/USAGE.md** — add a section for opLogs/keyframes + the
  oplogPersistence module.
- **BUG (user-reported 2026-07-11):** switching from the Stamp tool to
  Clone Stamp leaves the last stamp item still selected — stale stamp
  selection carries across the tool switch. Reproduce: pick a stamp item,
  switch to Clone Stamp, observe selection state.
- ~~FIXED in v7.17 (711f5f1)~~ **BUG (found by the real-gallery check, 2026-07-11 ~4:45am): the gallery
  manifest auto-clear is too eager.** AppShell's persist effect deletes the
  manifest whenever `photos` transitions non-empty → empty in a session
  (meant for Delete All). During the check, wasm rebuilds under the live
  dev tab (vite reloads + two 30s renderer freezes) drove that transition
  and WIPED the real gallery manifest. All 46 originals + 3 edit archives
  intact; only the gallery list was lost. Fix direction: clear only on an
  explicit user deletion (flag from Delete All / remove-last-photo), never
  inferred from a length transition. Recovery plan in ih-wire/SESSION_LOG.
- ~~FIXED in v7.17 (90d7641 — keyframes moved to the engine's byte-exact
  PNG codec; verified live incl. transparency)~~ **BUG (real-gallery check
  round 2, 2026-07-11 ~5:30am): restored base keyframe shows pixel
  corruption** (dashed white streaks) and dropped the
  pre-log strokes on an archive-restored photo — the recorded op itself
  restored and undid correctly. Prime suspect: the JS PNG round trip in
  oplogPersistence's default codecs — `createImageBitmap` was called
  WITHOUT `{ colorSpaceConversion: "none", premultiplyAlpha: "none" }`, so
  Chrome may color-convert/premultiply on decode (the Rust-side round trip
  is proven byte-exact; the JS codec layer is the untested seam). Second
  suspect: keyframe0 capture timing on loadFromSaved docs. Fix + a
  Playwright codec byte-round-trip test BEFORE any flag ships. (Protective
  action taken: that photo's oplog rows were purged; it loads from its
  clean archive.)
- ~~FIXED in v7.17 (90d7641 — history_labels synthesizes from ops)~~
  Cosmetic: history panel/status after an op-log restore.
- **Text box lingers on tool switch** (found during the v7.21 Stage-0
  fix): leaving the Text tool with an open typing box neither commits
  nor closes it — the box floats over the next tool's mode. Same
  teardown family as the v7.18 stamp fix; commit-on-deactivate in
  useTextTool is the likely shape.
- **No-change re-edit commit pushes a redundant undo snapshot** —
  re-opening a text annotation and committing without edits still adds
  an "Edit Text" history step (update_text_annotation always snaps).
  Cosmetic undo-depth noise; skip the snapshot when all fields match.
- **Text overlay WYSIWYG for background kinds (rect/bubble)** — the
  v7.21 ink-anchor mapping covers plain text only; bubble/rect text
  anchors the tile, and the overlay preview doesn't mirror the engine's
  bg padding/tail geometry. Align when the text tool gets its
  ToolModeToggle session.
- **STASHED (user, 2026-07-12 — for a future session): URL parameters
  / fragment (hash) routing.** Deep-link app context via URL params or
  hash routes — tool, sub-mode, possibly settings pane. User note:
  "maybe I should have added this before the Alt+, tool" — i.e. the
  command palette's jump-to-tool actions and any routing layer should
  share one canonical tool-addressing scheme; design them together so
  the palette's run() actions become route navigations (or vice versa).
- **Dead shadow tokens shadowing Tailwind's namespace** — `--shadow-sm`,
  `--shadow-md`, `--shadow-lg` in `:root` (styles.css) have ZERO consumers
  (grep across css/ts/tsx). They also *look* like they should drive the
  `shadow-sm/md/lg` utilities but don't (Tailwind v4 only mints utilities
  from `@theme`) — exactly the trap that left `.shadow-panel` inert for
  who knows how long. Delete them; keep `--shadow-panel`, which is real and
  now theme-scoped. Not done in the elevation pass to keep that diff to one
  target.
- **STASHED (user, 2026-07-12): Alt+, palette visual redesign** — move
  off the stock shadcn Command look: search input sized to the same
  H×W as the Settings panel's top search bar; padding similar to
  Windows 11 Start; a "top 10 most used" section (Win10-Start-style)
  above the keystroke/search results section. (The Recent group from
  v7.20 is the seed of the most-used section — needs usage counts, not
  just recency.)
- **Work the `exhaustive-deps` backlog down** — v7.42 wired a real ESLint
  flat config and fixed every error, but left 57
  `react-hooks/exhaustive-deps` warnings plus 5
  `react-refresh/only-export-components` visible on purpose. They are not
  autofixable in any safe sense: rewriting a dependency array changes when
  an effect re-runs. Work through them deliberately, a few per session, not
  in one pass.
- **Turn on the entropy/drift rules with a ratchet baseline** — `max-lines`
  and friends are the tripwire that would catch the next AppShell. Left off
  in v7.42 so the current AppShell wouldn't drown the signal on day one.
  Needs a recorded baseline to ratchet down from.
- **Decide on the React Compiler rule set** — `eslint-plugin-react-hooks` v7
  ships 17 rules in `recommended`, not the classic 2. Measured against this
  codebase: 123 problems / 66 errors (`refs` 35, `set-state-in-effect` 18,
  `purity` 10, `static-components` 2, `preserve-manual-memoization` 1).
  Genuine correctness rules; needs a session, not a flag flip.
- **`remove_object` returns `false` silently when `composite_cache` is
  cold** — real latent bug found while investigating Magic Eraser, and
  independent of fill quality. The caller can't distinguish "nothing to
  remove" from "cache wasn't warm", so a legitimate removal looks like a
  no-op. Fix when the Magic Eraser session resumes; noted in ADR-018's
  follow-up section.
- **Magic Eraser: the fair test hasn't been run yet** — the fill runs and
  lands (`removed: true`, genuine PatchMatch output), so the plumbing
  works and there is no wiring bug. But the only mask tried so far is an
  X-stroke, which covers roughly a fifth of the object and therefore
  copies the object back into its own hole — worst-case input, not a
  verdict. The untested case is a GENEROUS full-object mask: trunk, all
  fronds, plus a margin of sky. Run that before drawing any conclusion,
  and record no pyramid verdict until it has run. Worktree:
  `~/ai-repo/ih-magiceraser` (rebase onto master first — the `eraserMode`
  lift it was blocked on shipped in v7.40).

## From the Select-split session (2026-07-23, feat/selection-boolean-ops)
- Marching ants visible across ALL tools (Photoshop behavior) — currently only on the Select tool.
- Freehand lasso kind — engine polygon rasterizer exists via lasso_close; needs a drag-gesture UI.
- Sidebar height with 11 tiles at small windows — measure before tool #12 (see ADR-021 pre-mortem).
- Regression test for useEffectiveTool's unmatched-tool fallthrough (it hands drags to the clone stamp — the select case was nearly missed).
- Marquee preview overlay styling + additive/subtractive ants tint — combineHint is consumed by the cursor now, the ants tint is still Chris's design.
- Edge-definition drift: edge-aware wand walls on RAW Sobel magnitude, magnetic lasso normalizes against the image's peak (edges.rs edge_cost_map). "One definition of an edge" is currently two. Align the wand to the normalized form.

## From imagehorse-qc run 2 (2026-07-24, v7.44-46 gate)
- **`ShortcutModal` still lists 10 tools — Select (`S`) is missing.** A v7.44
  regression: `app/src/components/ShortcutModal.tsx:14-23` hard-codes the
  bare-key list and was last touched in v7.39, so the Select shortcut is
  undiscoverable in the one place users look it up. This is the 4th
  hand-maintained statement of the shortcut contract (TOOL_BY_KEY,
  toolConfig.shortcutKey, AppShell TOOL_SHORTCUT, ShortcutModal) and the only
  one no test covers — `useKeyboardShortcuts.test.ts` cross-checks the first
  two. Fix the entry AND extend the contract test to cover the modal.
- ~~**Esc does not dismiss the shortcuts modal**, and it has no `role="dialog"`,
  no `aria-modal`, and no focus trap (bespoke `motion.div`, not `ui/dialog`).
  Alt+/, the X button, and a backdrop click all close it. Pre-existing since
  v7.39. Folds naturally into the "converge on `ui/dialog`" modal-primitive
  consolidation already parked above.~~ **RESOLVED 2026-07-30 (NIGHT JOB III)** —
  rebuilt on `ui/dialog`; all five close paths and the trap verified in a
  browser against the production build. One bespoke overlay fewer.
- **Auto Compress / Resize has never been in History, and the reason is
  architectural — not an oversight.** `handleAutoCompress`
  (`AppShell.tsx:1909-1961`) never touches the canvas or the op-log: it loads
  the stored file via `getOriginal(p.originalKey)`, re-encodes it, and
  `putOriginal`s the result, repointing `originalKey`. History is the
  **per-photo canvas op-log**, so a file-level re-encode has no natural entry
  there, and Ctrl+Z (the WASM canvas undo stack) can't reach it. The code says
  so deliberately: it "intentionally does NOT set `hasBeenModified`".
  Chris's steer (2026-07-24): putting it in History is worth doing, with the
  multi-image run as the case to get right. **Note the batch worry is already
  handled structurally** — the op-log is keyed `[photoId+branch+chunkSeq]`, so
  "Compress All" writes one entry into each photo's OWN history and can never
  flood a single list; only the progress/toast is shared. The real design
  question is whether a file-level op belongs in a pixel-op log at all, or
  wants its own "file history" strip.
- **Auto Compress replaces the photo's original, so it compounds.** Because
  `putOriginal` is content-addressed and `originalKey` is repointed, the next
  run re-encodes an already-encoded file (generation loss), and A/B compare's
  "Original" stops being the true original after the first run. Measured on
  Toyota-Florida-Woods during QC: **`.webp` 87,642 B → `.jpg` 105,547 B** — a
  button called "Auto Compress" made the file 20% BIGGER and switched format,
  because it re-encodes an already-optimised WebP as JPEG at the export
  format/quality. The prior bytes survive (content-addressed dedupe means
  nothing is overwritten) but nothing references them and there is no UI to get
  back. Fix candidates: keep a pristine-original pointer separate from the
  working source, and/or skip the write when the re-encode comes out larger.
## From the night-repair run (2026-07-25, fix/night-repair)

Items 5–7 were NOT attempted — 1–4 were the stated success bar and are done.

- **Item 5 — storage-layer dedup + Auto Compress guard.** Deliberately deferred.
  It consolidates `putOriginal`/`getOriginal`/`deleteOriginal` across
  `dexie/db.ts` ↔ `originalsAdapter.ts` ↔ `originalsStore.ts` — the path that
  owns user originals, with no backup. Same reasoning the brief itself applies
  to `loadFromSaved`: this wants an awake session with persistence tests open,
  not a night slot. The compress guard (skip the write when the re-encode comes
  out ≥ source) rides along with it, since it lives in the same code path.
- **Item 6 — hookResult memoization.** Needs a before/after render count to be
  worth anything, and the claim ("CanvasArea re-renders on every AppShell
  render") is unverified. Measure first.
- **Item 7 — small-bore sweep.** Not started. Note the ShortcutModal half is
  independently confirmed: Escape genuinely does not dismiss it, and it has no
  `role="dialog"`, no `aria-modal`, no focus trap.
- **`useRealTier` is wired to nothing — likely a live billing bug.** Found in
  the fallow pass. Its own doc says that without it "tier gating only ever saw
  loggedIn and paid features stayed locked in the UI even though the server
  would have allowed them." Its sibling `useStoreUser` IS called
  (AppShell.tsx:210); this one has zero references. If that reading holds, paid
  accounts are being shown locked features. **Trace before anything else** — and
  do not let a dead-code pass delete it, which would bury the bug.
- **Guardrail baselines to pay down** (`scripts/guardrails.sh`): raw-colors 27,
  type-scale 9, z-index 4, rust-panics 67, aria-button 5. `as-any` is already a
  hard 0. Lower a baseline when you fix violations; never raise one.
- Still deferred from before: PatchMatch multi-res pyramid; edge-definition
  drift (wand walls on raw Sobel, magnetic lasso normalizes); marquee
  additive/subtractive ants tint; pristine-original pointer for Auto Compress;
  `loadFromSaved` at 111 cyclomatic.

## From the clonestamp-split session (2026-07-25, refactor/clonestamp-split)
- **Step 2 of the decomposition — useEngineStore.** Move the serializable
  snapshot (CloneStampState) into a zustand store with selector subscriptions;
  toolRef and callbacks stay in hooks. Then drop hookResult from CanvasArea's
  props, useMemo AppShell's textSettings literal, React.memo CanvasArea — with
  a render-count before/after (the claim to beat: "CanvasArea re-renders on
  every AppShell render"). Prereq landed: all five domain hooks return
  useMemo'd objects. Wants a session where AppShell isn't also being reshaped
  by the toolbar arc.
- The two clone groups INSIDE useEngineCore (532-564 vs 678-710 — the undo/redo
  snapshot-injection loops) and the shared decodePngToRgba↔exportImage.ts dup:
  now visible cleanly; dedup was out of scope for a verbatim split.
- **`app/tsconfig.tsbuildinfo` is tracked** — generated tsc -b cache that
  blocks worktree ff-merges whenever both sides rebuild. `git rm --cached` +
  gitignore it (needs the toolbar WIP landed first, since its copy is dirty).
- **Exec bits don't survive `git add` from a chmod'd worktree reliably** —
  deploy-sentinel.sh and guardrails.sh landed 100644 and every CI run since
  died at 'permission denied' (fixed a485f3d via `git update-index
  --chmod=+x`). When adding a script CI runs directly, verify
  `git ls-files -s` shows 100755 before pushing.

## Step 2 (useEngineStore / CanvasArea memo) — ATTEMPTED AND PARKED, 2026-07-25

Branch `refactor/engine-store` (`a8a5475`, pushed, **not merged**). Gate-green,
but measured as a net regression, so it stays off master.

**The measurement that settles it** — instrumented production build, 20
compress-quality-slider changes (AppShell/tool-store state CanvasArea never
reads):

| variant | CanvasArea renders |
| --- | --- |
| baseline (master) | **20** — the 1:1 claim CONFIRMED |
| store + narrow props + React.memo | 23 |
| same, memo removed | 23 |
| same, subscription narrowed to the 5 slices it reads | 24 |

**Why none of it helped.** A memo comparator instrumented to report which props
changed identity showed `hookResult` was **one of fifteen** unstable props. The
other fourteen are rebuilt inline in AppShell's JSX every render:

- inline arrows: `onCanvasLeave`, `onSelectionClick`, `onMarqueeCommit`,
  `onLassoMove`, `onLassoClose`, `onCropChange`, `onPenCommit`, `onPenHitTest`,
  `onPenEditStart`, `onPenEditCommit`, `onPenEditCancel`
- inline literals: `guides`, `annotations`, `drawSettings`

With any one unstable, `React.memo` blocks nothing and only costs the compare.
The store is not free either: `setSnapshot` runs imperatively from `syncState`,
outside React's batching, adding ~3 renders per 20 that the old `useState`
didn't.

**So the order in the brief is wrong.** Memoizing those 14 props is the
PREREQUISITE, not a follow-up — and it's the risky part (14 dependency arrays;
a wrong one is a stale closure, which is a real bug, not a perf nit). Do that
first, re-run the same slider measurement, and only then decide whether the
store and the memo earn their place.

Salvageable from the branch, independently correct: the module-scope hoist of
`useEffectiveTool`'s idle no-ops (three fresh closures per render), the
`useMemo`'d `textSettings` literal, and CanvasArea taking five narrow props
instead of the 62-key object.

---

## Toolbar five-group arc — leftovers (v7.51 → v7.53, 2026-07-26)

The arc itself shipped; these three are what it didn't finish.

### 1. Marketing nav underline is "off kilter" — UNDIAGNOSED

Chris reports the primary nav's hover / current-page rule sits wrong.
**Measure it before changing anything.**

Already ruled out, so don't re-do this: `.nav-pill__glide` (a `<span>`, not a
pseudo-element) is the ONLY underline in the nav — there is no `::after` rule
fighting it anywhere in `marketing/src/styles.css`. The geometry also reads
correct on paper: `moveTo()` sets `--gx` from `a.offsetLeft` and `--gw` from
`a.offsetWidth`, and `.nav-pill__links` is `position: relative` with no border
and no padding, so `offsetLeft` and the glide's `left: 0` share an origin.

Whatever is wrong is therefore something only a live measurement will show —
sub-pixel, font-swap timing, the condensed-bar reflow, or the `bottom: -2px`
vertical. It went undiagnosed because the Playwright MCP died mid-session and
browser navigation was declined; Chris suspects his Debian Chrome needs a
reboot. Serve `marketing/` and compare the glide's box against the active
link's box directly.

### 2. ADR-023 — the five-group restructure

Supersedes ADR-021/022 in part. Should record: the group/sub-tool split, why
sub-tool identity is a store field rather than derived (six sub-tools share a
legacy tool id), why `activeSubTool` and `pickedColorHistory` are deliberately
outside `partialize`, the URL grammar change, and the cost — one extra click to
reach a sub-tool, bought for a legible five-item top row.

### 3. `Ctrl+K` then a letter — designed and approved, not built

Chris approved the design 2026-07-26. Digits `1`–`5` stay on the groups; a
chord reaches sub-tools, with the letter scoped to the ACTIVE group so it only
has to be unique among ≤13 rather than 34. `Ctrl+K` opens a hint overlay
listing the active group's sub-tools and their letters, so it's discoverable
rather than memorised. Derive the letters from the registry — a hand-written
table is the exact drift this arc spent three releases removing. `Ctrl+K` is
interceptable in Chrome (Linear, Notion and GitHub all take it), unlike
`Ctrl+T`/`N`/`W`.

### Also worth knowing

- **`imagehorse-qc` is owed.** This arc touched canvas dispatch, the cursor,
  every tool panel and the routing layer. Per the project's definition of done
  that flags a QC pass before the next release, and one was already outstanding
  from v7.44–46.
- **Colour-picker history is per-session by design.** Persisting it means
  adding `pickedColorHistory` to `useToolStore`'s `partialize`, which is an
  IndexedDB schema change and therefore goes through the `dexie-migration`
  skill. Not a one-liner.
- `docs/toolbar-migration-map.md` still lists the ORPHANs. O-2 (Text
  background) and O-3 (OCR) were closed by Chris's calls during review;
  O-1 (Paint's `brushMode: "erase"`, unreachable since before this arc) is
  still open and still undeleted.

- **`Ctrl/Cmd + M` is missing from the shortcut modal.** Found while adding
  `Ctrl+\` (the shipping celebration) to it on 2026-07-27. `Ctrl/Cmd + M`
  toggles Move-layer / Layer Settings and is bound at
  `useKeyboardShortcuts.ts:246`, but no group in `ShortcutModal.tsx` lists it —
  the Edit group stops at `Alt+D`. Left out of that diff deliberately: the ask
  was for one shortcut, and this is the same class of gap the derived
  "Tool groups" list was built to end. Worth checking whether any other
  `Ctrl`-chord in `useKeyboardShortcuts` is undocumented before hand-adding a
  second row, rather than fixing them one at a time.

- **The status bar's tool hint is group-level and mislabels sub-tools.** Checked
  2026-07-27 across ten routes. The mechanism is right — slots 1–2 tool-specific,
  slot 3 cycling the generic pool every 3 minutes (`CYCLE_MS`), `Alt+/` pinned
  last — but the first slot's label names one sub-tool and then keeps saying it
  for every other sub-tool in that group: `#/enhance/resize` and
  `#/enhance/adjust` both read "1 compress", `#/create/pen` reads "3 brush",
  `#/edit/crop` reads "2 adjust". The digit is correct (it selects the group);
  only the label is wrong, so on Pen the bar tells you to press 3 for "brush".
  Fix is to derive it from `activeSubTool` instead of the group — the same
  registry-derivation that fixed `ShortcutModal`'s drift. `#/select/marquee`
  shows no tool hint at all, which is expected: Select has been keyless since
  `S` was removed, and the digit was deferred to "the next UI pass".

- **Dexie has no `blocked` / `versionchange` handler — the next schema bump can
  wedge users with a stale tab open.** Found 2026-07-27 while chasing the
  "can't change photos" report. `ImageHorseDB` (`app/src/lib/dexie/db.ts:140`)
  declares versions 1–2 and registers no `blocked` listener. When a future
  `.version(3)` ships, a user with an older tab open blocks the new tab's
  upgrade: Dexie fires `blocked`, nothing handles it, `db.open()` never settles,
  and every IndexedDB call hangs forever with no message. That includes
  `idbSave`, which `savePhotoEdit` awaits BEFORE its (now bounded) cloud block,
  which the photo switch awaits — so the whole gallery locks.
  Deliberately NOT fixed here: it lives in the Dexie layer, so it goes through
  the `dexie-migration` skill (Vivek), and it is not what caused the reported
  bug — that was the unbounded Convex hang, fixed in `useEditPersistence.ts`.
  Timing out the LOCAL save is the wrong fix (it is the only copy of the user's
  work); handling `blocked` with a "close your other tabs" prompt is the right
  one. Verified today that two tabs on the SAME version do not wedge, so this is
  latent until a version bump — which makes it something to land BEFORE the next
  Dexie migration, not after.

  **RESOLVED 2026-07-29 — guard verified and shipped, and the "prompt" half of
  this entry is superseded.** The spec above asked for a "close your other tabs"
  prompt; the implementation logs to the Diagnostics Window instead, and that is
  now the DECISION rather than a drift: `MultiTabScreen` (v7.57) already claims a
  single editing tab with a visible screen, `blocked` is a wait that clears
  itself rather than a failure, and with `versionchange` in place only a
  pre-guard tab or another browser profile can even reach it. Reasoning lives in
  `db.ts` beside the handler. Verified under fixtures in
  `app/src/lib/dexie/upgradeGuard.test.ts` (4 tests), including a control that
  proves the fixture is real: without the guard the same upgrade IS blocked and
  nothing is logged. Gotcha found doing it — **Dexie stores `.version(n)` as IDB
  version `n * 10`**, so db.ts's `.version(2)` is IDB 20 and a raw open at 3
  fails as a DOWNgrade.
  RESIDUAL GAP, accepted: if a block persists, the app still waits with only a
  Diagnostics entry the user has no reason to open. The fix is a timeout that
  raises MultiTabScreen's shape, not a new modal — its own change, not started.

## From the v7.58 night run (rings, status bar, GC audit — 2026-07-28)

- **The update prompt cannot fire in production.** `UpdatePrompt` is wired to
  both existing triggers, but both sit behind `__IH_SW_MODE__`, which ships
  "off": `swBoot.setupServiceWorker()` returns on the constant, and
  `checkBuildSkew` early-returns unless the mode is "on" (and `version.json`
  isn't emitted in default builds anyway). So the dialog is real, tested, and
  currently unreachable by users — exactly as the toast was before it. Arming it
  is a service-worker rollout decision under ADR-019 (see
  `project_sw_precache_dark`), not a UI change, so it was NOT done here. Two
  ways forward when someone decides: ship the SW ON, or run the skew check
  independently of the SW (it needs no worker — just `version.json` emitted in
  default builds and the `__IH_SW_MODE__` guard dropped from `skew.ts`). The
  second is much smaller and would make the prompt real on its own.
- **`CanvasResize`'s "Remove canvas" still uses the old red-on-red tint.** The
  three gallery delete confirms went to a white label on solid red (4.83:1);
  this one didn't, because it is an inline panel action sitting beside "Resize
  canvas" rather than a dialog confirm, and a solid red block there would shout.
  It measures the same ~3.99:1 as the old dialog buttons did, so it is a real
  (small-text) contrast item — but the fix is a design call about panel actions,
  not a find-and-replace. Same question for any other `bg-destructive/15` that
  appears later.
- **`--destructive` is 3.80:1 against white on the dark theme.** Found while
  fixing the delete button: the palette's own `--destructive` +
  `--destructive-foreground` pairing does NOT clear 4.5:1 on dark, because dark
  `--destructive` is the lighter #e55032. Worked around with a separate
  `--confirm-danger` (#dc2626, both themes) rather than changing a token the
  whole app uses. If destructive text/fills matter elsewhere, the real fix is at
  the token: darken dark-mode `--destructive`, then delete `--confirm-danger`.
  Same shape as the known `--accent` 2.67:1 shortfall on light surfaces.
- ~~**`deleteOriginal` is not refcounted**~~ **FIXED 2026-07-29** — all four
  repoint sites now go through `deleteReplacedOriginal` (lib/originalRefs.ts),
  reproduced under fixtures first. Original entry kept below for context.
- **`deleteOriginal` is not refcounted — it can delete a blob another photo is
  using.** HIGH: this is data loss, not garbage. Full write-up and the exact
  four-step repro in `docs/content-addressed-gc-audit.md` § "Not asked for, and
  more serious". Short version: originals are content-addressed and shared
  (`handleDuplicateSelected` reuses `originalKey` for zero-copy duplicates), the
  `oldKey !== entry.uploadKey` guard only knows about that photo's own baseline,
  and `originalsAdapter.deleteOriginal` deletes unconditionally where
  `db.ts:285` guards with `if (refs === 0)`. Compress a photo, duplicate it,
  compress the duplicate → the first photo's current original is deleted while
  it still points at it. NOT reproduced on a real gallery on purpose (doing so
  destroys an original); it needs a session with fixtures. Fix the eager deletes
  BEFORE adding any collector, or a sweep will be built on top of a sharp edge.
- **Auto Compress strands one original per run** (`handleAutoCompress`'s
  per-photo callback repoints `originalKey` with no `deleteOriginal`). The other
  three repoint sites do collect — see the audit doc's table. Measured pile is
  0 B only because Auto Compress has never run on the audited profile.
- **Deleting a photo strands up to two originals.** `handleRemovePhoto` deletes
  the edit archive and the gallery entry, never the content blobs. ~4.5 MB per
  photo on a 12-photo gallery.
- **`db.ts`'s header is stale for originals.** It describes `image-horse-dexie`
  as a "NEW, parallel database" that "does NOT touch the three live hand-rolled
  stores", but the audit found no `image-horse-originals` database at all and 12
  real originals in `image-horse-dexie/originals` — `USE_DEXIE_ORIGINALS` is on.
  `photos`/`workingCopies` genuinely are still empty, so only the originals half
  of that comment is wrong. Fix when next in the file (NOT now — it is mid-change
  for the upgrade guard).
- **The GC audit has no UI surface.** Deliberate: a Diagnostics Window tab is the
  right home, and `DiagnosticLogOverlay.tsx` was mid-change for the Dexie upgrade
  guard tonight. Run it from the console per the audit doc until then.
- **Clone Stamp shares a button with the ink Stamps** — Chris, 2026-07-28: "clone
  stamp should be in a different button then the ink stamps, not sure where those
  stamps should go". Both are Create sub-tools today (`create/clone-stamp` and
  `create/stamps`), so they are already separate tiles; the coupling that is left
  is the legacy `stamp` ToolType they share, which is what makes the stale-stamp-
  selection bug possible (see the 2026-07-11 entry above). Where the ink stamps
  belong is genuinely open — OPEN, deliberately not guessed. Options written up
  in the night-run summary; the move itself is a registry migration and
  `tool-module-migration` says one tool per session, and clone stamp goes last.
- **ADR possibly owed for v7.58, Chris to route.** Two of tonight's changes look
  trigger-level under the `adr` skill: (a) the focus-indicator vocabulary — focus
  is now neutral ink + dashed on `outline`, with new `--focus-ring` / `--confirm`
  / `--confirm-danger` tokens, which changes every focus ring in the app and is
  the kind of thing a second engineer would need explained; (b) the
  module-state + `useSyncExternalStore` pattern in `lib/pwa/updatePrompt.ts` for
  getting non-React module state onto the screen without a store and without a
  CustomEvent — a new pattern others will copy. ADRs are Dara's lane and this
  session was told not to spawn agents, so nothing was drafted. Not blocking:
  both are documented at their definition sites with the measurements.

## From the v7.60 night run (persistence bugs + entropy delta — 2026-07-29/30)

- **OPEN (architecture, not a 2am call): when the op log and the working copy
  disagree, which one wins?** Surfaced while fixing #21. `restoreFromOplog` runs
  FIRST in `useImageSession` and a `"restored"` result short-circuits the
  working-copy path — so the op log wins unconditionally, on the assumption that
  it is always at least as fresh. #21 broke that assumption (a dropped tail made
  the log strictly older than the working copy, and restore still preferred it),
  and #21 is now fixed — but the ORDERING is still an unconditional preference
  rather than a comparison, so any future way for the log to fall behind
  reproduces the same silent regression to an older document.
  Options, none chosen: (a) compare timestamps and take the fresher — needs a
  trustworthy "as of" on both, and the manifest's `updatedAt` is written at save
  time while the working copy's is written at a different moment; (b) keep the
  op log authoritative and make every path that can leave it behind loud instead
  of silent; (c) restore the log, then diff against the working copy and warn.
  (b) is closest to the current design's intent. This needs a decision before
  anything else changes the save ordering.

## From NIGHT JOB III (2026-07-30, `night/job-iii`)

- **OPEN — the canvas coordinate mapping is duplicated in ~8 more places, and
  fallow does not report them.** Phase 1 extracted `useCanvasCoords` and used it
  in the three hooks fallow named (`usePaintTool`, `useMoveLayerTool`,
  `useMagicEraserTool`). The same `(clientX − rect.left) * canvas.width /
  rect.width` mapping is still written out by hand in `useColorPicker.ts`,
  `useTextTool.ts`, `useEngineCore.ts:291`, `useEmojiTool.ts:51`,
  `useDrawingTools.ts:621`, `useRedStampTool.ts:66`,
  `features/canvas/CanvasArea.tsx:1124`, and
  `app/session/useSelectionActions.ts:63`. They vary just enough (`Math.floor`,
  destructured vs `cx`/`cy`, `rect` vs `r`) to fall under fallow's clone
  threshold, which is why the tool only ever flagged three of eleven. NOT done
  here — one target per session, and the brief named the three. Each is a
  one-line swap now that the hook exists; `useEngineCore`'s `Math.floor` variant
  needs a deliberate decision about whether flooring belongs in the shared hook
  or the call site.
- **`npx tsc --noEmit` from the repo root checks nothing** — CLAUDE.md's
  "Commands" block and the Definition of Done both name it, but there is no
  `tsconfig.json` at the repo root (it lives at `app/tsconfig.json`), so tsc
  finds no inputs and prints its help banner. Same shape as the dead eslint gate
  CLAUDE.md itself warns about at length. **Not urgent**: the real typecheck IS
  enforced — `.githooks/pre-push` runs `pnpm --filter stamp-tool exec tsc -b` —
  so the repo is guarded, the documented command is just the wrong one. Fix is a
  doc edit (`pnpm -C app exec tsc --noEmit`) or a root tsconfig with references.
  Left alone: editing CLAUDE.md was not this session's target.
- **FINDING, not a leftover: `dup:1002f0a8`'s "89 lines" was ~12.** See the
  Phase 1 commit body. Recorded here because the next person to read a fallow
  line-count should know the number is the matched *window*, not the shared
  code.
- **OPEN (HIGH, and the biggest thing this session found): `ui/dialog` gives no
  focus trap, no focus restore and no `aria-modal` — for EVERY dialog in the
  app.** Measured in a browser on the production build, then reproduced on the
  untouched Diagnostics Window to prove it is not local to ShortcutModal:
  1. **The trap never engages.** `DialogContent` does
     `onOpenAutoFocus={(e) => e.preventDefault()}` and its comment says focus
     "moves into the dialog container instead". It does not — focus stays on
     whatever opened the dialog, which is OUTSIDE Radix's focus scope, so
     `FocusScope` has nothing to trap. With a dialog open, Tab walked Tools →
     Gallery, both behind the backdrop. **The comment is wrong, which is why
     nobody caught it.**
  2. **No focus restore.** Radix's modal content restores to `DialogTrigger`.
     Almost nothing in this app uses `DialogTrigger` — dialogs open from store
     flags, shortcuts and the command palette — so the restore resolves to null
     and focus lands on `<body>`. Confirmed still on body 2.1s after close with
     the origin element still mounted.
  3. **No `aria-modal`, and the background is not hidden either.** Radix signals
     modality by aria-hiding the content's siblings; `#root` measurably does NOT
     get `aria-hidden` (every other body child does). So AT can still reach the
     app behind any open dialog.
  ShortcutModal now fixes all three at its own call site (`onOpenAutoFocus`
  focuses the container, `onCloseAutoFocus` restores a captured element,
  `aria-modal="true"` set explicitly). **The fix belongs in `ui/dialog`**, where
  it would land for the delete confirms, Settings, Diagnostics, the command
  palette, the update prompt and the subscription sheet at once — but that is a
  change to every dialog in the app and wants its own session with a pass over
  each consumer. Start from ShortcutModal's three props; they are the working
  version. Also fix the misleading comment.
- **OPEN (cosmetic): six now-orphaned CSS rules.** `.shortcut-modal`,
  `-header`, `-title`, `-icon`, `-close`, `-close-icon` in `styles.css` lost
  their last consumer when the modal moved onto the primitive (the body, group,
  row, kbd and footer rules are all still live). Left in place deliberately —
  deleting CSS was not this session's target and wants a grep across the
  marketing site too.

## From the AI-Rename session (2026-07-31, batch describe + multi-drop)

- **OPEN: the `portrait` subject over-fires on warm scenes.** Kovac's
  skin-tone rule (`src/describe.rs`) fires on any warm mid-tone, so
  beige stucco, sunlit stone and wooden interiors read as skin. Against
  the 12 bundled sample photos the first pass named a white-car-on-a-
  beige-wall shot `orange-portrait`. Two guards went in (`kind == "photo"`
  and `detail != "smooth"`, threshold raised 0.14 → 0.18) and a
  regression test pins the flat-warm-wall case, but **the tightened
  thresholds were never re-measured against those 12 real photos** — the
  browser re-run was declined mid-session. Next session: re-scan the
  sample gallery, diff against the before-list below, and tune from
  evidence rather than from taste. A clustering check (is the skin
  contiguous?) beats any threshold here.

  BEFORE-LIST — 12 bundled samples + 3 synthetic, `{desc}-{n}`, measured
  against the production build at skin_frac > 0.14 with no `detail`
  guard. The three synthetic ones (13-15) are a solid red fill, a solid
  blue fill and a white card with black bars, and all three were right:

  ```
  01 sky-portrait      05 green            09 orange-portrait   13 red-graphic
  02 lime-nature       06 orange-portrait  10 orange-portrait   14 blue-graphic
  03 dark-orange       07 green-nature     11 orange            15 bright-white-screenshot
  04 orange-portrait   08 orange           12 cyan-smooth
  ```

  Suspect entries to re-check: 04 is a white car against a beige wall,
  06 is stone-and-tree — neither is a portrait. 01 genuinely has people
  in it and must KEEP its portrait tag; if a tightening kills 01 too,
  the tightening is wrong.
- **OPEN: the describer has no bench.** `describe_image` is off the
  flush path and sample-capped at ~160×160, so it is not a hot-path
  risk, but a 15-photo scan visibly froze the renderer for ~5s in the
  smoke run. The cost is `makeWorkingCopy` decoding each photo, NOT the
  Rust — the panel yields every 8 photos (`YIELD_EVERY`), which is too
  coarse when nothing in the loop awaits a cache miss. Either yield every
  photo or move the scan to the codec worker.
- **OPEN: ADR owed.** New engine module (`src/describe.rs`), a new
  wasm export, a fourth Batch sub-mode and a filename-collision rule
  are between them trigger-level. Dara has not written it. Decisions to
  record: local Rust describer chosen over a Replicate caption model
  (demo mode is sacred; the `alt` job type in `convex/ai.ts` still has
  no model registered and remains the upgrade path), and hand-rolled
  JSON over serde (serde is gated behind the `tiles` feature).
- **NOTE: `batchGroup.description` in `toolGroups.ts`** still reads
  "Stamp a logo, add text or rename every loaded photo at once" — it
  predates the fourth sub-tool. Cosmetic, left out of this diff.

## From NIGHT JOB IV (2026-08-01, `night/job-iv`)

- **OPEN: both failure modes of the start-screen "Paste (Ctrl+V)" button are
  silent.** `handlePasteFromClipboard`'s async fallback wraps
  `navigator.clipboard.read()` in a bare `catch {}` and then falls through to
  `if (!source) return` — so a denied permission gives the user no toast, no
  message, nothing. Worse, the promise does not always reject: with a
  backgrounded (`visibilityState === "hidden"`) window it **never settles**, and
  the function hangs forever. Found during NIGHT JOB IV while trying to verify
  that branch. The fix is a `finally`/timeout plus a real error toast, but it
  wants a decision about what to say when the browser simply refuses.
- **OPEN: `NewActions.tsx:260-276` paste handler has no text-field guard.**
  AppShell's window paste handler checks `INPUT`/`TEXTAREA`/`isContentEditable`;
  this one does not, so while the New surface is up an image paste is captured
  regardless of where focus sits. PRE-EXISTING — landed `f1cbc7e` 2026-06-26,
  193 commits before v7.61, which never touched the file. Only reachable because
  the old `Modal` primitive has no focus trap (already tracked above), since the
  New dialog contains no text inputs of its own. Low severity.
- **NOTE: Escape did not close the New dialog** in the NIGHT JOB IV run, and it
  is not exposed as `[role="dialog"]`. Consistent with the known pre-`ui/dialog`
  primitive debt; not investigated, flagged only.
- **METHOD worth reusing: real clipboard testing IS possible from WSL.** Chrome
  runs on Windows here, so `powershell.exe -Command "Set-Clipboard -Path …"`
  over a `\\wsl.localhost\<distro>\…` UNC path puts genuine CF_HDROP file lists
  on the real clipboard (no `/mnt/c` access needed), and a CDP `ctrl+v` then
  delivers a real paste event with real `File` objects. Verify with
  `Get-Clipboard -Format FileDropList`. What is NOT possible unattended: the
  async Clipboard API (`read`/`write`) — both require a VISIBLE document and
  park forever on a backgrounded window.
- **OPEN: same-group sub-tool switching by URL does not work.** From
  `#/batch/rename`, navigating to `#/batch/ai-rename` updates the hash but the
  Rename panel stays mounted; `#/batch/logo` fails identically, and logo
  predates v7.61 — so this is NOT the new sub-tool's fault. Cross-group nav
  works (`#/enhance/compress` → `#/batch/ai-rename` is fine) and a full load on
  the same hash works, so it is specific to changing sub-tool WITHIN a group in
  a booted session. Reading `activateSubTool` does not explain it: it calls
  `setModeOf` even when `activeTool` is unchanged. Measured NIGHT JOB IV.
- **OPEN (observed once): blank tool-panel body.** After the two failed URL
  navigations above, clicking the AI Rename tile lit the tile and set the status
  bar to "5 AI Rename" while the panel body rendered empty — no header, no
  button, no console error. Not reproducible from a clean reload, where tile
  switching is fine. Plausibly a consequence of the routing gap leaving the
  store mixed; recorded rather than diagnosed.
- **OPEN: `describe_image` exposes no raw ratios.** Diagnosing the `portrait`
  misfire required applying a whole diagnostic rename pass
  (`{n}-kind-{kind}-subj-{subject}-det-{detail}`) just to read the tags back.
  Returning `skin_frac` / `green_frac` / `sky_frac` / `edge` in the JSON, or
  behind a debug flag, makes the next measurement one call instead of a gallery
  rewrite.
- **SETTLED: the `portrait` tightening is near-inert — do NOT tune it further
  with thresholds.** Re-measured 2026-08-01 against the same 12 samples: exactly
  one of twelve changed (#10 `orange-portrait` → `orange-smooth`), and neither
  target (#04 white-car-on-beige, #06 stone-and-tree) moved. All 12 are
  `kind == "photo"` so that guard excludes nothing; `detail` is empty for 10 of
  12 so `detail != "smooth"` could only touch #10; the 0.14 → 0.18 raise moved
  nothing at all. #01 (real people) kept its tag, so the change is harmless, just
  ineffective. Warm stone and beige stucco genuinely occupy skin's RGB region —
  the next attempt needs spatial clustering (is the region contiguous and
  face-sized?), not another scalar.

## From NIGHT JOB V (2026-08-04, `night/job-v`)

- **DONE: `feat/vector-tool` no longer exists — but it was already gone when
  this run started.** The brief asked for it to be deleted locally and on both
  remotes. It was absent from all three before anything was deleted:
  `git branch -a` had no match, and `git ls-remote --heads` returned 12 heads on
  origin and 1 on codeberg with no `feat/vector-tool` among them (checked that
  ls-remote actually worked rather than reading an empty grep as absence —
  Night Job IV's log still says "It is pushed to origin", which is now stale).
  So the housekeeping item was already satisfied; nothing was deleted tonight.
- **DONE, and nothing is at risk: the code is preserved as an annotated tag.**
  An earlier draft of this entry claimed `38275af` was a dangling object that
  would be garbage-collected. That was wrong — checked properly, it is NOT in
  `git fsck --lost-found`, because the annotated tag `abandoned/vector-tool`
  points at it, and that tag is on BOTH remotes (origin and codeberg) as well as
  locally. Same preservation pattern as `negative-result/rayon-wavefront`. The
  tag's own annotation already records the build state (241 tests passing at its
  base), the reconciliation cost (16 files / 29 hunks) and the salvage:
  `app/src/features/tools/vectorGesture.ts` + `vectorGesture.test.ts`. Recover
  with `git show abandoned/vector-tool` — no tagging or rescue needed.
  That translation layer only has a job if the Shapes-into-Text merge is ever
  revived; master still ships Shapes as its own tool (`#/create/shapes`), so
  nothing on master is currently missing it.
- **CORRECTION — the tier-mapping sketch is already implemented; do NOT port it
  as an open item.** The brief asked to move it here "so the delete loses
  nothing". The sketch lives in `38275af`'s commit message, which argued that
  Convex `free|pro|team` vs UI `demo|loggedIn|paid` had "no translation layer,
  no owner, no test", and used that as the reason to give the tool-vocabulary
  translation a name, a file and tests. The tier half of that shipped with the
  v7.50 paid-tier gating fix: `userModeForTier()` in `app/src/lib/tiers.ts` is
  the named translation, and its doc comment already states the same two-
  vocabularies problem and the deliberate `null → loggedIn` (never `paid`)
  choice. Re-filing it as OPEN would have created a stale entry for solved work.
  What is preserved here instead is the generalised lesson, which is the part
  that was actually at risk:
  > **This repo's recurring failure shape: two vocabularies for one concept with
  > nothing translating between them.** It cost paying customers free-tier caps
  > for months (Convex tier vs UI mode). Give the translation a name, a file and
  > tests rather than open-coding it into the call sites, where the copies drift.
- **OPEN (incidental, low): `?v=` on the app URL is swallowed by the share
  route.** Loading `http://localhost:4181/?v=fix1#/create/shapes` rendered the
  "Shared image / This link is no longer available." screen instead of the
  editor. Found while cache-busting a rebuild; a query param used as a cache
  buster silently becomes a share-link lookup. Harmless in normal use, but it
  makes `?v=`/`?cb=` unusable for QC cache-busting — bump the port instead.
- **NOTE for browser QC: synthetic key delivery is unreliable in a backgrounded
  window and reads as an app bug.** Two Escape presses appeared not to close the
  update prompt and several Tab presses appeared not to move focus. Both were
  the harness, not the app: installing a capture-phase `keydown` listener showed
  the key that "did nothing" had never arrived, and the press that did arrive
  closed the dialog immediately. Always confirm the event landed before
  reporting a keyboard bug. (`document.visibilityState` was `"hidden"` the whole
  run while `document.hasFocus()` was `true` — same conditions as Night Job IV.)
- **DEFERRED (Chris, 2026-08-04: "Edit shape is fine for now"): history labels
  don't say WHAT changed.** `update_shape_annotation` snaps a fixed
  `"Edit Shape"`, so a recolour, a move and a resize all write the same row.
  Recolour a square then drag it and History shows two identical `Edit Shape`
  entries with nothing to tell them apart — in the one place you'd look for
  "the step where I changed the colour". Fix is to pass the label in from the
  call site (`Recolour Shape` / `Move Shape` / `Resize Shape`); small, but it
  touches the Rust crate so it needs a wasm rebuild and a size note. Same
  applies to text annotations if it's done.
- **CLOSED by a human, 2026-08-04: the start-screen "Paste (Ctrl+V)" BUTTON
  works.** Open since NIGHT JOB IV, which could not test it — the button uses
  `navigator.clipboard.read()`, which needs a visible, focused window and a
  permission prompt, so the promise simply parks forever in a backgrounded tab
  and no agent can reach it. Chris verified it by hand against the v7.64 build
  on localhost:4190 and confirmed it imports. The silent-failure risk noted
  there is unchanged and still worth a toast (a rejected read is swallowed by a
  bare `catch {}`, then `if (!source) return` exits with no user feedback), but
  the happy path is no longer unverified.

## Docs cleanup (2026-08-04)

- **RESOLVED, not OPEN: the auth doc is not radioactive — forward-only move is
  enough, filter-repo is not warranted.** The brief asked for a judgement call
  and offered to log it OPEN. Measured instead, against the shipped client
  bundle: the Convex deployment URL, the Clerk issuer and the Clerk
  publishable key are **all already in `www-dist/assets/index-*.js`** — public
  by design, readable with View Source. `sk_` secret keys: **zero**, in the
  bundle and in the doc. So `share-links-auth-mismatch.md` exposed no
  identifier that was not already public.
  What it did add is the *narrative* of how prod auth was misconfigured plus a
  credential-free recipe for enumerating which issuers a deployment trusts —
  recon value, not secrets. That is worth un-publishing going forward and not
  worth rewriting history for. **Git history still contains all four files and
  both remotes still have them**; anyone who wants them can get them. If that
  ever becomes unacceptable, `git filter-repo` + a force-push to two remotes +
  invalidating every existing clone is the actual cost, and it buys very
  little given the identifiers are in the bundle anyway.
- **OPEN: `docs/internal/` is untracked, so it has no backup.** Same fragility
  as PARKING_LOT.md and the SESSION_LOGs — it lives on this machine only. The
  security roadmap is the one that would hurt to lose. A private mirror repo,
  or an encrypted copy in the existing backup, would fix it. Not done.
- **NOTE: two internal-ish directories now exist.** `docs/.hidden/` (older
  session scratch: night-job logs, prompts, RUN_SCHEDULE) and `docs/internal/`
  (this pass). Both gitignored, overlapping in purpose. Worth consolidating to
  one; not done today to keep the diff readable.

## WebGPU Phase 0 (2026-08-04)

- **DONE: correctness proven, `maxDelta: 0`.** Five cases on Intel Xe-LPG —
  noise 64x64 r1, noise 61x37 r5 (non-square, catches w/h transposition), hard
  edges 48x48 r3, tiny 5x5 r12 (every tap clamps), noise 40x40 r30 (the
  ceiling). 0 differing channels out of 41,128. Run it with
  `localStorage.setItem("ih_webgpu","1")`, reload, then
  `await window.__ihGpuBlurSelfTest()`.
- **OPEN: the harness cannot run in CI.** No WebGPU in jsdom or on GitHub's
  runners, so `src/filters.rs` + `src/simd/blur.rs` and
  `app/src/lib/webgpu/blurReference.ts` are now a matched pair with nothing
  enforcing the match. Cheapest guard: a `guardrails` step that fails when one
  side is edited without the other. Until then this drifts silently, and the
  first symptom is an export that does not match the screen.
- **OPEN: `@webgpu/types` is not installed.** The spike ships a hand-written
  `app/src/lib/webgpu/webgpu-types.d.ts` covering only the ~15 interfaces used.
  Swap is: `pnpm --filter stamp-tool add -D @webgpu/types`, delete that file,
  add `"types": ["@webgpu/types"]` to `app/tsconfig.json` (it has no `types`
  field today, so it currently pulls in every `@types/*` package).
- **OPEN: no timing comparison yet, and the numbers so far are NOT a benchmark.**
  Every call creates and destroys its own device and pipeline, which dominates
  at these sizes. The one hint worth keeping: at radius 30 on 40x40 the GPU was
  6.0 ms against the CPU oracle's 13.2 ms, while at radius 1 on 64x64 it was
  29.8 ms against 7.5 ms — i.e. consistent with setup cost dominating and the
  kernel width being where GPU starts to win. Phase 3 (real timing) needs a
  persistent device, a warm pipeline, and realistic image sizes.
- **NOTE: the engine blurs a circular brush region; the GPU path blurs a
  rectangle.** Same two passes over a different extent — Rust applies the
  circular write-back mask *after* the blur. Any wiring into the actual Blur
  tool has to reproduce that mask, or brush strokes will come out square.

## From NIGHT JOB VI (2026-08-05, `night/job-vi`)

- **DONE: audit finding #2 fixed for single delete, fixture-proven.** Phase 1
  reproduced the leak (two stranded blobs per delete, green tests as evidence),
  Phase 2 inverted the same tests over `collectDeletedPhotoOriginals`. The
  uploadKey baseline goes too — through the guard, so a shared baseline
  survives. 12 tests.
- **OPEN — the other three delete paths leak identically, and they are where
  the real pile came from.** Read-only re-measure on the 4190 QC profile:
  **19 orphaned originals / 55.3 MB, plus 22.6 MB edits + 6.1 MB keyframes
  (~84 MB total) against 1 live photo.** That pile predates tonight and was
  made by gallery REPLACEMENT, not single deletes: `handleDeleteSelected`,
  `confirmDeleteAll`, and `handleStartFresh` all drop entries without
  collecting. 2 and 3 are mechanical now the collector exists; 4 needs the
  manifest-replacement moment found. Extend collect-at-source; still no
  resident sweeper.
- **OPEN — the ~84 MB already stranded needs a ONE-SHOT cleanup, not a
  sweeper.** Collect-at-source only prevents new orphans. Run it after paths
  2–4 are fixed, ideally from the Diagnostics window with the audit's numbers
  on screen before and after.
- **OPEN — `contentAudit` cannot see the batch-baseline roots.** It counts
  logoBaselineRef/textBaselineRef keys as orphans (they are in no manifest).
  Harmless for measuring, wrong for any cleanup driven off the audit's orphan
  list — a one-shot cleanup MUST use `collectExtraRoots()` the way the delete
  path now does, or it will break re-apply while Batch is open.
- **NOTE — audit hook shipped:** `await window.__ihContentAudit()` (dev builds
  or `ih_webgpu` on) returns `{ report, markdown }`. Wired by a Fable agent,
  mirroring the GPU harness pattern.

## From the archive-corruption fix (2026-08-05, `fix/switch-corruption`)

- **DONE: Phase 1 — the ownership guard, fixture-proven both ways.** The repro
  passed against shipped code first (3 tests: one engine document written under
  any photo id, an untouched photo handed an undo stack it never earned), which
  is what made the mechanism evidence rather than inference. Inverted to 8 tests
  over `lib/engineDocument.ts`. `savePhotoEdit` returns a boolean now, and the
  Convex leg in `hooks/useEditPersistence` is gated on it — that leg re-reads
  the engine and builds its own archive, so a refused local write would
  otherwise still have uploaded the wrong pixels. Same bug one layer out, and
  only reproducible signed in.
- **OPEN — ownership is recorded on intent, not completion, in one of the four
  sites.** `loadPhotoFromEntry` calls the session's `loadImageFromPixels`, which
  voids the engine promise (`void stamp.loadImageFromPixels(...)`), so
  `setEngineDocument(entry.id)` runs when the engine has been *handed* the
  pixels, not when it has taken them. A failed load would leave the marker
  naming a photo the engine never got — which is precisely the unguarded
  behaviour shipping today, so it degrades to the status quo rather than to a
  refusal. Making the engine load awaitable would let ownership follow the
  document instead of the intent. The other three sites (op-log restore,
  `loadFromSaved`, fresh import) are all recorded after a real await.
- **OPEN — two AppShell delete paths never clear ownership, deliberately.**
  `handleDeleteSelected` and `confirmDeleteAll` (AppShell.tsx ~638 and ~1075)
  null the active photo without a `setEngineDocument(null)`. Skipped on purpose:
  CLAUDE.md says do not add to AppShell, and the omission only ever produces
  `unknown → allow`, i.e. today's behaviour, never a false refusal. It leaves a
  stale marker naming a deleted photo, which is harmless now (nothing is left to
  save under it) and a latent trap for any future path that saves without
  loading. Wire it when those handlers move out of AppShell.
- **NOTE — ownership must be recorded BEFORE the `isCurrent()` supersession
  bail, and the reason is counterintuitive.** The marker describes the ENGINE,
  not the UI. A superseded switch still replaced the document, so bailing first
  would leave the marker on the previous photo while the engine holds the new
  one — turning the next entirely legitimate save into a refusal. False
  refusals lose real work, which is worse than the corruption being fixed.
- **NOTE — `window.__ihSaveGuard()` ships UNGATED, unlike `__ihContentAudit`.**
  It returns `{ holding, allowedKnown, allowedUnknown, refused }`. Not behind
  the DEV/`ih_webgpu` gate because the re-measure that decides whether the guard
  works runs against a production build, and the guard's failure mode is being
  inert — allowing everything because ownership is unknown — which is invisible
  without the counts. A healthy build is allow-known-dominant with
  allow-unknown near zero (boot only). High allow-unknown means an ownership
  site is missing and the guard is decoration.
- **DONE: Phase 2 — the switch inherits the overlap guard, and stops waiting on
  the network.** `handleSelectPhoto` called `savePhotoEdit` directly, bypassing
  `savingRef` entirely — that is how one brush stroke became ten concurrent
  uploads of identical bytes. It routes through `flushEditArchive(outgoing,
  { detachCloudUpload: true })` now.
- **NOTE — `flushEditArchive` had to take an explicit photo id, and the reason
  is a trap.** `activeIdRef` is advanced to the INCOMING photo *before* the
  saveOutgoing block runs (set synchronously so gallery cycling reads right), so
  the obvious `flushEditArchive()` with no argument would have asked for the
  outgoing document under the incoming id. Phase 1's guard would then have
  refused it — a correct refusal of an incorrect request, turning a routing
  change into a silently dropped save. The guard caught the naive version of
  Phase 2 before it was written.
- **NOTE — detaching the upload is only safe because the capture is
  synchronous.** In `useEditPersistence`, everything from the engine reads down
  to `encodeArchive` is await-free, so the bytes are in hand before the switch
  continues. An upload that re-read `toolRef` after detaching would read the
  INCOMING photo's document and upload it under the outgoing key — the same
  corruption, in the cloud copy, where the local guard cannot see it. Adding any
  `await` above that line silently breaks this.
- **OPEN — Phase 2's three pins are browser-observable, not fixture-proven.**
  "Switch doesn't wait on network", "upload still lands", "a failed upload can't
  wedge the gallery" (the v7.57 bug) all need a running app. This repo has NO
  React hook-test harness — no `@testing-library`, zero `renderHook` tests, 28
  test files all plain module-level. Proving these in fixtures means adding
  `@testing-library/react`, which is a new dependency and therefore an ADR
  trigger, not a thing to slip into a corruption fix. Phase 6's re-measure owns
  them until then.
- **OPEN — three more `savePhotoEdit` call sites still bypass `savingRef`.**
  `useImageSession` handleAddFiles (~line 250) and AppShell ~659 and ~2167. The
  ownership guard makes them safe from cross-photo writes, so this is now a
  redundancy problem rather than a corruption one. The AppShell two want doing
  when those handlers move out, per "do not add to AppShell".
- **DONE: Phase 3 — redundant uploads skipped by CONTENT HASH, not undo depth,
  and the deviation is deliberate.** The brief specified "record undo depth at
  last successful sync, skip when unchanged". That signal is lossy in an
  ordinary case: paint A (depth 1) → sync → undo (depth 0) → paint B (depth 1,
  redo cleared) puts both counters back exactly where they were over completely
  different pixels, so a depth-keyed skip drops stroke B. Engine mutators are
  not the problem — `set_artboard_border` and `update_text_annotation` both call
  `snap()`, checked in lib.rs/annotations.rs — the collision is undo followed by
  a fresh edit. SHA-256 of the encoded archive makes the skip a fact rather than
  an inference.
- **NOTE — the skip is on the UPLOAD ONLY; the local IndexedDB write is never
  skipped.** That asymmetry is the safety argument. IndexedDB is the restore
  path and has no backup, so a wrongly-skipped local write loses the user's
  work, whereas a wrongly-skipped upload costs cloud freshness until the next
  real edit. Same one-directional bias as the ownership guard.
- **NOTE — `crypto.subtle` is secure-context only.** A dev server reached over a
  LAN IP has no `crypto.subtle`, where the hash would throw into the catch that
  reports "cloud save failed" and silently disable sync altogether. `archiveHash`
  returns null there and the caller uploads — shipped behaviour.
- **OPEN — the sync record is session-lived and per-tab.** `lastUploadedRef` is
  a ref, so a reload re-uploads once per photo, and two tabs do not share it.
  Cheap direction to be wrong in, but it means the 28→4 number will look
  slightly worse right after a reload. Persisting it would need a store or a
  Dexie field, which is a `dexie-migration` decision.
- **OPEN — a true edit-epoch belongs in the engine.** One `self.edit_epoch += 1`
  inside `snap()` (single choke point, 21 call sites in lib.rs alone) plus a
  getter would give an exact, hash-free change signal and let the LOCAL write
  skip safely too. Rust change → `rust-wasm-loop` skill, wasm rebuild, and the
  `.d.ts` hand-sync gotcha. Not slipped into a corruption fix.

## Convex audit (2026-08-05, read-only, `fix/switch-corruption`)

Counts are from `brave-ant-608` — the deployment production actually
authenticates against. `pastel-alligator-180` (the one Convex labels prod) is
`readOnly` through the MCP tooling, so it could not be counted directly; every
one of its tables reports an inferred schema of `Never`, i.e. no document has
ever been written to it.

- **VERDICT (Phase 8) — half the schema IS dead, on both axes.** `projects`,
  `images`, `layers`, `annotations`, `history`: **0 client references** (grepped
  for `api.<name>` across app/src) and **0 rows each**. No internal
  cross-references either — the convex/ modules do not call each other. That is
  a complete server-side document model that nothing has ever used, the same
  shape as the empty Dexie `photos` table the GC audit measured. Live tables for
  contrast: users 3, photo_edits 4, shares 9, ai_jobs 8, recent_texts 12,
  subscriptions 0. **Not deleted** — dropping schema is a one-way door and
  Chris's call.
- **NUMBER (Phase 9) — 76 orphaned storage files, 3,535.51 MB (3.45 GB).** Of
  105 `_storage` files totalling 3,644.09 MB, only 29 are referenced by
  `photo_edits.storageId`, `shares.storageId`, or `ai_jobs.{input,mask,output}
  StorageId`. **97% of stored bytes are referenced by nothing.** `crons.ts` is
  empty, so nothing has ever swept them. The dead `images` table also has a
  `storageId` field but holds 0 rows, so it cannot be hiding references. This is
  a billing line, not tidiness — but measure-then-decide, and no file was
  deleted.
- **CONFIRMED (Phase 7) — the cloud copies are corrupt too, and it is 4 for 4.**
  All four `photo_edits` rows carry canvasW 1445 / canvasH 2128 — one canvas,
  four different photoKeys, one userId. At most one of those is legitimately the
  car. One of the keys is `1785902617476-9abnyjzfnrd`, the same `jzfnrd` the
  trace recorded uploading at 0s / 7s / 15.4s / 25s. The corruption reached
  Convex, which is why Phase 2 gated the cloud leg on the ownership guard rather
  than only the local write.
- **OPEN — the four bad cloud rows are still there.** Nothing was deleted or
  rewritten. Repair is a decision, not a cleanup: three of the four almost
  certainly want removing so the next login does not restore the car over three
  photos, but which one is the real car needs a human looking at it.
- **OPEN — no cron, so orphaned storage accrues forever.** Whether a sweeper is
  worth building is the same question the IndexedDB GC audit asked. The upload
  path can succeed at the file upload and fail at the `saveEdit` mutation,
  which strands a file by design.
- **DONE: Phase 4 — the debounce measures idleness again, not render quiet.**
  `flushEditArchive` is a useCallback over `[stamp, savePhotoEdit]`, and `stamp`
  is a fresh object on nearly every engine state sync, so its identity churned
  constantly — and both autosave effects listed it as a dependency. The debounce
  tore down and re-armed its 2.5s timer on RENDER churn rather than on edits,
  which is why photo jzfnrd saved at 0s / 7s / 15.4s / 25s at an identical undo
  count. Held through a ref instead; the effects now depend only on
  `activePhotoId`, `stamp.state.undoCount` and `hasBeenModified`.
- **NOTE — the pagehide/visibilitychange listeners were re-registering too.**
  Same dependency, smaller cost: both listeners were removed and re-added on
  every render that changed `stamp`. They register once for the life of the hook
  now. That path is the last-chance write before the tab closes and had no
  business being churned.
- **OPEN — Phase 4 has no fixture coverage, same reason as Phases 2 and 3.** It
  is React effect scheduling; proving it needs a hook harness this repo does not
  have. The recorder can show it: `saveMs` timings should stop landing at
  identical undo counts. Kept the instrumentation in the worktree for exactly
  that re-measure.

## Convex outage (2026-08-05) — free plan exceeded, deployment disabled

- **CAUSE, confirmed from the usage dashboard: File Storage 3.68 GB against a
  1 GB limit — the ONLY resource over.** Everything else is far under: function
  calls 13K/1M, database 65.86 MB/512 MB, database I/O 7.54 MB/1 GB, egress
  0 B/1 GB, search 1.56 MB/512 MB, deployments 6/40. The audit's 3,535 MB of
  orphaned storage IS the outage. Deleting the 76 orphans lands at ~109 MB,
  about 11% of the limit.
- **The deployment is disabled for READS too**, not just writes — the same
  audit query that ran at 00:38 is rejected an hour later. There is no
  programmatic path to clean up until it is re-enabled (support@convex.dev, or
  Pro). The pre-outage audit numbers are the last good reading.
- **NOT the generator: `photoEdits.save` is correct.** It deletes the superseded
  file (`ctx.storage.delete(existing.storageId)`, photoEdits.ts:33) before
  repointing, so re-saving a photo does not strand its previous archive. Checked
  rather than assumed — it was the obvious suspect and it is innocent.
- **THE GENERATOR: upload succeeds, `saveEdit` fails.** The archive is uploaded
  first and the pointer committed second, so any failure between them strands a
  file permanently. v7.57's 8s `withTimeout` on `saveEdit` guarantees one every
  time it trips — the file is already in storage, the mutation is abandoned, and
  the user sees "saved locally only". `generateUploadUrl` 3.1K vs `save` 3.1K on
  the dashboard, with the gap inside the rounding, is consistent with ~76.
- **OPEN — the targeted fix is small: delete the just-uploaded file when
  `saveEdit` fails.** Best-effort, in the existing catch, which already knows
  the storageId. Turns the timeout from an orphan generator into a clean
  abandon. Not done tonight: the deployment cannot take the change and it wants
  its own verification.
- **READY, UNCOMMITTED: `convex/cleanupOrphanedStorage.ts`** — one-shot
  internalMutation. Recomputes the reference set in the same transaction rather
  than trusting the audit's list (a stale id list is how a cleanup deletes a
  live file), scans all five storage-referencing fields including the empty
  `images` table, defaults `dryRun: true`, batches at 200, and REFUSES outright
  if the reference scan returns zero against non-empty storage — that is a
  failed scan, not a clean sweep, and proceeding would delete everything.
  Push with `npx convex dev --once`, NOT `convex deploy`.

## Phase 1a — scalar mirror (2026-08-05, `refactor/scalar-mirror`) — STOPPED

- **VERDICT: 117 → 109, not 117 → ~90. The brief's own bar was not met, so
  nothing was built.** Full reasoning in
  `docs/engine-worker-scalar-mirror-finding.md` on that branch; both measurement
  scripts are committed so the number is reproducible rather than asserted.
- **The mirror already existed and already had one publisher.** `useEngineCore`
  has exactly two `setState` calls — `INITIAL_STATE` and the one inside
  `syncState()` — and `syncState` already publishes width, height, layers and
  activeLayerId. The pre-mortem's named failure (a JS-side copy nothing owns)
  does not apply here.
- **OPEN — the real latent drift risk is `syncState`'s 71 hand-placed call
  sites across 12 files.** Nothing enforces that a mutation is followed by a
  sync; it is a discipline, not a structure. That is a live correctness question
  TODAY, independent of the worker migration, and it is far cheaper to fix than
  the migration. Best single follow-up from this run.
- **OPEN — 8 repointable sites remain available** (AppShell ×2, BatchSettings
  ×4, ExportPane ×1, useMaskActions ×1). Individually safe — none is
  mutation-adjacent — but they buy 117 → 109, which is why they were left.
- **NOTE — a worker migration's cost is dominated by PLAIN MODULES, not
  components.** 14 of the 38 scalar sites are in `exportImage`,
  `openraster/export`, `oplogPersistence`, `tilesFlush` and `editPersistence`,
  which take a tool handle and have no React state. They need async signatures
  regardless; a mirror can never serve them. The residual 117 is mostly
  buffer-returning calls (`export_png` 7, `get_shape_annotations` 6,
  `get_text_annotations` 6) where the bytes are the point.
- **CORRECTION — `loaded_photo_id` does not exist.** Cited in the brief as last
  night's precedent for "engine-owned truth, exposed, not inferred". `grep`
  finds nothing on master, on `spike/engine-worker`, or in any commit message
  across all refs. What landed is `lib/engineDocument.ts`, a JS-side marker with
  a single publisher — the opposite pattern. `oplog_generation()` exists but is
  op-log persistence state. Do not plan against the engine-side version existing.
- **DONE: syncState coverage audit — 2 real gaps found, both unfixed by choice.**
  `scripts/syncstate-audit.mjs` on `refactor/scalar-mirror`; full write-up in
  `docs/syncstate-coverage-audit.md`. 121 mutator call sites, 65 with no
  following sync, narrowed to 8 by "does it snapshot", narrowed to 2 by hand.
- **OPEN — `handleSelectAll` and `handleDeselect` (useSelectionActions.ts) push
  undo history without syncing.** `select_all` → `snap_selection("Select All")`
  (selection.rs:481); `clear_selection` → `snap_selection("Deselect")` (:507).
  `handleDeleteSelection` twenty lines below does sync — these were missed, not
  decided. Consequence: History panel under-reports a step, and `dirtyRef`
  (`state.undoCount > 0`) reads stale, so a photo whose ONLY change is a
  selection action is not marked dirty and does not autosave. Narrow — any later
  paint syncs and it catches up. **Fix is two lines**, not applied because the
  run was scoped to an audit.
- **NOTE — the audit's six false positives are the useful part.** A sync can
  live in the CALLER (openraster/export → ExportPane) or in a SHARED HELPER
  (useTransforms → commitGeometryChange), and `exportImage.ts` mutates a
  THROWAWAY instance it then frees. Any future version must resolve one hop of
  indirection before reporting; as-is it is 75% false-positive on Tier 1.
- **OPEN — nothing enforces mutation → sync, and that is the root condition.**
  The two gaps are symptoms. A structural fix (engine handle only reachable
  through a syncing wrapper, or a dev-mode assertion that `undo_count()` matches
  `state.undoCount` after each handler) retires the class. Design decision, not
  a cleanup.
- **OPEN — 57 Tier-2 sites unexamined**: non-snapshotting mutators with no
  following sync (`set_editing_shape` ×7, `load_image` ×7, `set_selection_combine`
  ×3 …). May or may not touch a published field.

## Orphan generator closed (2026-08-05, `fix/orphan-on-failed-pointer`)

- **DONE: `photoEdits.discardFailedUpload` + the client catch that calls it.**
  The upload-commits-before-pointer hole is closed. The catch did NOT already
  have the `storageId` as assumed — it was a `const` inside the try; hoisted to
  a `let`.
- **NOTE — the delete is reference-checked, and that is load-bearing, not
  defensive.** The usual way into that catch is v7.57's 8s `withTimeout` around
  `save`, and a client-side timeout does not mean the mutation failed. Deleting
  unconditionally would leave a `photo_edits` row pointing at nothing — an
  archive that reads as present and decodes to nothing, strictly worse than an
  orphan. The scan is also the authorisation check: a bare storage id has no
  owner, so the only safe rule is "delete only what nobody references".
- **⚠️ DEPLOYMENT ORDER — `discardFailedUpload` is NOT on `brave-ant-608` yet.**
  Verified against `functionSpec`; `convex codegen` generated bindings but
  pushed nothing. Push the Convex function BEFORE or WITH the client
  (`npx convex dev --once`, not `convex deploy`). Shipping the client alone is
  not dangerous — the call sits inside the swallowing catch — but it collects
  nothing until the function exists.
- **OPEN — the 3.45 GB pile is already gone**, cleared during the outage, so
  there is nothing to sweep retroactively. This only prevents the next one.
- **GOTCHA — a fresh worktree has no `pkg/`** (gitignored wasm output), so
  `stamp_tool` fails to resolve, `useKeyboardShortcuts.test.ts` never runs, and
  the suite reports **344 passing instead of 369** with the failure printed
  ABOVE the summary line. `tail`-ing the output hides it completely. Symlink
  `pkg/` from the main repo the same way `.env.local` is symlinked.
- **DONE: the dot and the save now share one dirty definition.** QC found text
  edits not lighting the modified dot while brush strokes did — not a text bug.
  The dot was `undoCount > 0`; the save is `undoCount > 0 || hasBeenModified`,
  so a photo could be written to disk while the gallery showed it untouched.
  Aligned to the save condition. Slider drags now dot before Apply, which is
  correct — switching mid-drag already saves them.
- **OPEN — the quality slider has an undo that does not undo.** Apply pushes a
  "Compress" marker so History shows a step, but `snap()` captures pixels and a
  quality-only apply changes none. Undo consumes the step, restores identical
  pixels, and leaves the slider where it was. A correct fix puts the quality
  value on the engine `Snapshot` (`push_compress_marker(quality)` + restore on
  undo + a getter) — Rust work, `rust-wasm-loop` gates, wasm rebuild, `.d.ts`
  hand-sync. **Do NOT do the JS-side version** (a map from history depth to
  quality): that is the unowned-mirror pattern that caused the archive
  corruption and the syncState drift within 24 hours of each other.
- **NOTE — brightness/contrast/saturation are already correct.** They snap and
  latch to the slider's released position rather than firing per tick, so one
  drag is one undo step. `set_layer_opacity` does NOT snap — layer opacity is
  not undoable. Unexamined, lower stakes than quality.

## Snapshot parameters — Phase 1 (2026-08-05, `fix/orphan-on-failed-pointer`)

- **VERDICT: Phase 2 is unnecessary — the Snapshot already carries them.**
  `Snapshot` holds `Vec<Layer>` + active/width/height/selection, and `Layer`
  holds visible, opacity, name, mask and both annotation vecs.
  `restore_snapshot` puts all of it back (lib.rs:681-687). Nothing to add.
- **OPEN — three setters never push a step**, though the values they change are
  already captured and restored: `set_layer_opacity` (layer.rs:829),
  `set_layer_visible` (:820), `rename_layer` (:838). No struct change, no format
  change, no ADR. Opacity is slider-driven, so it also needs commit-on-release
  at the UI layer — copy `EffectsSettings`, which latches brightness/contrast/
  saturation to the released position. That UI half is the larger part.
- **OPEN — export quality needs a DECISION before any code.** It is the only
  genuine "undo that does not undo", but quality is not engine state (the codec
  worker encodes, not the engine) and putting it on the Snapshot is a persisted
  -format change → archive v6 → ADR. Three options: (1) onto the Snapshot,
  (2) **remove the "Compress" marker** so no fake step is offered, (3) leave it
  documented. Option 2 is defensible enough that defaulting to (1) would be
  building the larger thing without making the argument.
- **NOTE — the classifier is 94% false-positive on its top bucket**, worse than
  the syncState audit's 75%, for the same reason: a static scan cannot see that
  the RESTORE handles state the OPERATION never wrote. 16 of 17 hits are correct
  code. Treat `scripts/snapshot-parameter-audit.mjs` as a shortlist generator.
- **NOTE — out of scope, confirmed:** blend mode is not an engine concept (no
  field on `Layer`; the Convex `layers` column exists but that table has 0 rows
  and 0 client references), and guides live in `useGuidesStore`, never in the
  engine.
- **DONE: ADR-031 engine half — export quality on the Snapshot.** Captured by
  `make_snapshot`, APPLIED by `restore_snapshot`. `push_compress_marker(quality)`
  snaps then sets (that order matters — a step carrying the incoming value would
  "undo" to the state just requested). `set_export_quality` for the live drag
  with no history; `export_quality()` getter. +331 B (+0.043%), 761,213 →
  761,544. 7 engine tests; cargo 120 default / 203 tiles+patchmatch.
- **DONE: the UI half.** `syncState` publishes `exportQuality`; the slider and
  every export path read `stamp.state.exportQuality`. `useToolStore.quality`
  survives as the PERSISTED PREFERENCE that seeds a fresh document — bound as
  `qualityPreference` so it cannot be mistaken for the display value. Two roles,
  not two owners. The seed is skipped once `undoCount > 0` so it can never
  clobber a restored value.
- **OPEN — quality does not survive reload yet.** That is the last piece of
  ADR-031 and it is the archive v6 work: the binary cloud archive needs the
  field, and the local raw-IDB record needs a tolerant read. Until then a
  reopened photo is seeded from the preference, not from what it was saved
  with. ⚠️ When v6 lands, a RESTORED document must keep its stored value and
  the seed effect must yield to it.
- **GOTCHA — an AI worktree's `pkg/` must be its OWN directory, not a symlink to
  master's.** It was symlinked here to make `stamp_tool` resolve for vitest; a
  `build:wasm` would then have overwritten master's shipped artifact with a
  branch build — the stale-pkg trap the git-routine already warns about, from
  the other direction. Moved the symlink aside and copied the real directory
  before building.
- **NOTE — the pen tool records ONE step per committed path, and that is by
  design.** Verified in the engine: two paths give two "Add Pen Path" steps,
  editing one gives "Edit Pen Path", and undo removes a path on both the
  snapshot and op-log paths. Chris confirmed whole-path undo is good enough.
- **OPEN — per-anchor undo while DRAWING a pen path** (Illustrator-style: Ctrl+Z
  removes the last anchor rather than the whole curve). Not a bug — in-progress
  anchors live in the JS overlay and never reach the engine until commit, so
  there is nothing to undo. Would need either a JS-side anchor history or the
  in-progress path moving into Rust. The latter is a genuine language-tier
  candidate (felix-mender's lane), not a quick fix.
- **NOTE — ADR-031 took THREE tries, and the pattern is worth keeping.** The
  engine change was right first time; both bugs were at the seam. (1) The
  op-log undo path returns before `restore_snapshot`, so quality was dropped in
  exactly the config production ships — invisible to unit tests because a bare
  tool has no started log. (2) The live drag wrote to the engine, so the
  snapshot captured the value being APPLIED rather than the one being replaced.
  204 engine tests and 369 vitest caught neither; a human clicking Ctrl+Z caught
  both.
- **DONE: Ctrl+Z steps back one pen anchor while drawing** (capture-phase
  listener in PenOverlay — the global shortcut binds keydown on `window` in the
  bubble phase and AppShell mounts first, so bubble-phase interception is
  impossible). **DONE: the quality slider commits on release** via
  `commit_export_quality`, so quality is undoable without pressing Apply.
- **DECIDED (Chris, 2026-08-06): per-anchor steps do NOT go in the History
  panel.** `snap()` clones the whole layer stack, so a step per anchor is a full
  document snapshot per anchor: ~7.8 MB each at 1198×814/2 layers, ~96 MB each
  at 4000×3000. Against `DEFAULT_MAX_HISTORY_BYTES` = 512 MB, **six anchors on a
  normal photo would exhaust the budget and start evicting the user's real edit
  history** — a worse bug than the one it fixes. Ctrl+Z already steps per anchor;
  History keeps one entry per committed path.
- **OPEN (only if per-anchor history is ever wanted) — a lightweight history
  entry type** storing the annotation delta rather than the layer stack. That is
  a change to the Snapshot/History model and needs an ADR; it is the only
  version of this that scales.

## From NIGHT JOB VII (2026-08-06, `night/trail-generator`) — ABORTED, premises false

- **⚠️ THE FINDING, and it outranks the night's work: two consecutive briefs
  were built on work that does not exist.** The brief opened with an "already
  verified — do not redo" list: `?nosw=1` / `?nosw=clear` living in
  `swRegistration.ts`, "confirmed in the live bundle"; a cache deny-list for
  sw.js / version.json / WASM "confirmed against production bytes"; "24 tests
  pinning it"; the update path "dark until v7.69". None of it exists. The recap
  that preceded it likewise asserted ADR-032, "the SW is armed and verified",
  and trail squares stopping at 2026-08-04. These are not hazy recollections —
  they carry filenames, test counts, and claimed sourcing. Something upstream is
  recording planned work as shipped, and each brief then treats the last one as
  settled. Until that source is found, every "already verified" list has to be
  re-checked, which is precisely what such a list exists to prevent.
- **NOTE — how the absence was established, since the next brief will probably
  assert it again.** Seven independent checks, not one grep: `find -iname
  "*swregistration*"` across `/home/clj/repo` + `/home/clj/ai-repo` → 0;
  `git log --all --diff-filter=A -- '*swRegistration*'` → never added on any
  branch; `git grep nosw $(git rev-list --all)` → 0 in every commit in history;
  `grep -ril "servicework"` (the broad concept search) → the same four files and
  no new one; `status --porcelain` on all four worktrees → clean; all three
  stashes by name and by content → 0 (stashes are NOT covered by `rev-list
  --all`, and that was the one real hole); the served production bundle
  `index-imCnxPyf.js` → **0** `serviceWorker`, **0** `nosw`. Claim is bounded to
  those two trees — a checkout elsewhere would change it.
- **NOTE — the real SW facts, for whoever picks this up.** `app/src/lib/pwa/`
  holds exactly five files: `skew.ts`, `skewVerdict.ts`, `skewVerdict.test.ts`,
  `swBoot.ts`, `updatePrompt.ts`. Control is BUILD-TIME only: `VITE_ENABLE_SW`
  → `SW_MODE` (`off`/`on`/`kill`) → `__IH_SW_MODE__` via vite `define`
  (`app/vite.config.ts:52`). There is no `URLSearchParams`, no
  `location.search`, no runtime bypass anywhere in the pwa directory. A stranded
  user CANNOT self-rescue by URL. `VITE_ENABLE_SW` appears in neither
  netlify.toml, package.json, nor `.github/`, so production ships `off` and the
  registration code is constant-folded out — matching the v7.41 "shipped dark"
  record. `/sw.js` returns `content-type: text/html`, i.e. the SPA fallback, not
  a worker (verify by content-type, never by HTTP 200).
- **BLOCKED — Phase 1 (observe the update dialog firing in production).**
  Impossible as written and it cannot even fail informatively. Its own fallback
  — "report whether the SW saw the update at all, `registration.waiting` vs
  `installing`" — presumes a registration object; there is none, because the
  registration code never reaches the bundle. Nothing to observe, and no client
  with a warm cache to observe it on. Also required a production deploy, which
  is not an unattended action.
- **BLOCKED — Phase 2 (demo mode offline).** Nothing precaches, so nothing can
  serve offline. The test would confirm only that the app fails offline, which
  is already known from the bundle contents.
- **OPEN — Phase 3, but not as briefed.** Documenting `?nosw=1` would publish a
  recovery path that fails on the exact day it is reached for. What IS worth
  doing: the real recovery procedure is the `VITE_ENABLE_SW=kill` eviction, and
  it is already written thoroughly — including the why of kill-not-unset — at
  `app/vite.config.ts:42-51`. The gap is PLACEMENT, not absence: an incident
  procedure lives in a build-config comment where nobody looks mid-incident.
  Mirror it into README or a support doc. Low urgency while the SW is dark,
  because there is nothing installed in anyone's browser to evict; it becomes
  urgent the moment `on` ships.
- **DONE — Phase 4, the trail generator (`cbb16e7`, unpushed).**
  `gen-trail-data.mjs` ran `git log` with no ref, so it read whatever HEAD
  happened to be and the squares depended on which working tree it ran in: from
  a feature worktree it counted unmerged commits as shipped; from the main tree
  mid-release it missed the commits being released. Both silent. Now resolved
  against `master` (falling back to `main`, then `HEAD` for a detached clone) so
  every worktree agrees, plus a warning naming how many commits it is not
  counting. Caught the residual case on the way in: commits.ts had been
  generated before the v7.68 release commit landed, so 2026-08-06 read 5 instead
  of 6 — **344 → 345 commits**. Same class as Change-summary #15 (2026-07-27),
  which the ordering fix addressed and the worktree workflow reintroduced.
  Gates: `node --check` pass; re-run with 1 unmerged commit warns and leaves
  output byte-identical.
- **OPEN — Phase 5, offline-aware UI.** `navigator.onLine` + the existing toast
  infrastructure: a quiet offline indicator and "will sync when you're back"
  instead of a silent failure, pairing with the shipped `ih_upload_retry` work.
  Genuinely real and independent of the SW — worth doing on its own merits, since
  network failures happen without a service worker. NOT done here because it
  changes visual output, which the project's own overnight rules exclude as
  unverifiable headless. Note the brief's framing ("the app can load offline
  now") is false; the value is honest handling of network loss, not offline
  operation.
- **OPEN — Resize Layer conditional visibility: STOPPED at Phase 1, premise is
  false.** The brief ("hide the tile until a second layer exists") rests on
  "Resize Layer refuses on single-layer documents". It does not. Measured twice
  against the shipped wasm on 4241: a 1-layer document
  (`layer_count` 1, kinds `["content"]`) returns `has_paste_preview() === true`
  after `begin_layer_resize_preview()`. The Rust refuses on exactly one
  condition — `self.active >= self.layers.len()` (`src/layer.rs:983`), an
  invalid active index, not a layer count. Building the gate would HIDE A
  WORKING TOOL from the documents where it works, and would not touch the
  actual complaint. The predicate itself is cleanly derivable if it is ever
  wanted — `stamp.state.layers` is a full mirrored `LayerInfo[]` with
  `kind: "canvas" | "content"` (ADR-016) plus `activeLayerId`, published
  synchronously by `useEngineCore` syncState, so both "total" and "content
  count" are available with no new boundary crossing and nothing to invent
  JS-side. Note the brief's claim that these come from the Phase 1a scalar
  mirror is also wrong — `refactor/scalar-mirror` is **2 commits unmerged**;
  the mirror being relied on is `get_layers()`, which has always been there.
- **OPEN — the REAL Resize Layer complaint, still unfixed.**
  `usePastePlacementTool.ts:123` seeds the initial rect to the entire canvas
  (`{x:0, y:0, width: canvas.width, height: canvas.height}`), so the bounding
  box lands exactly coincident with the image edge and its handles sit on the
  canvas boundary. Nothing visibly changes at the moment of click, which reads
  as "the button does nothing". A regular paste seeds a rect at the pasted
  content's size, comfortably inside the canvas — which is why resizing by
  other means works. Candidate fixes: inset the initial rect, or render handles
  outside the boundary. Needs Chris's eyes to confirm the visual half before
  anyone codes it. The only gate on the tile today is `disabled={!imageReady}`
  (`ToolsSidebar.tsx:368`) — nothing layer-related.
- **OPEN (High) — the signed-in app hangs on "Loading your workspace…" on a
  FRESH ORIGIN.** Found by a second QC session 2026-08-06. Not branch-specific:
  master on a fresh port hung **118 s** with no resolution, and the same build
  logged-OUT loads fine, so it is the signed-in hydration path specifically.
  Clerk calls all return 200 including the Convex token exchange, then **zero
  Convex requests follow** — the app gets a token and never connects. Convex
  runs over WebSocket, so HTTP request tracking shows nothing; whoever picks
  this up should watch the WS frames, not the network panel. Suspected but
  unproven: a fresh origin must hydrate ~12 photos / ~57 MB down from Convex.
  Cross-reference [[project_clerk_two_instances]] (local and prod run different
  Clerk instances; prod talks to the DEV deployment) and the 2026-08-05 Convex
  free-plan outage above — either could be the real cause. **This blocks
  signed-in QC on any new port**, which is why QC now runs logged out.
- **OPEN (Med) — Resize Layer's "targets the selected layer" is still
  unverifiable through the UI.** A default document has 2 layers, "Photo" and
  "Canvas", and clicking the Canvas row does NOT move `layer-active` — so the
  two cannot be compared. A text annotation does not create a layer (count stays
  2). No UI route was found to produce a second SELECTABLE layer, so the
  riskiest step of the resize QC remains proven only by code reading:
  `onSelectLayer` → `setActiveLayer` → `set_active_layer` → `self.active`, and
  `begin_layer_resize_preview` clones `self.layers[self.active]`. Two questions
  fall out and neither is answered: is the Canvas row deliberately unselectable,
  and if so is `hide_layer` still correct when the artboard is active?
- **OPEN (Low) — layer rows carry selection only via the CSS class
  `layer-active`**, on plain `<li>` elements with no `aria-selected` or
  `aria-pressed`. Screen readers and automation cannot tell which layer is
  active. WCAG 2.1 AA is a project invariant, so this is a real gap, not polish.
- **OPEN — Chris wants real AVIF encoding, and it is a dependency decision.**
  No encoder exists anywhere today: nothing in `package.json`, no `ravif`/
  `rav1e` in `Cargo.toml`. Chrome decodes AVIF but cannot encode it from a
  canvas, and that is not a flag — there is no browser API to reach. Options:
  (1) `@jsquash/avif` — **7.97 MB unpacked**, one transitive dep
  (`wasm-feature-detect`); lazily importable so it need not hit the initial
  bundle, but it ships a second wasm alongside `stamp_tool`. (2) a `ravif`
  feature in the crate — keeps one wasm but lands in the size gate the
  `rust-wasm-loop` skill governs, and the crate currently has no AV1 anything.
  (3) WebCodecs `VideoEncoder` av01 + hand-rolled ISOBMFF muxing — no
  dependency, but writing an AVIF container by hand is its own project. A new
  dependency of that size is an ADR trigger either way. NOT started — the
  honesty fix (`fix/export-size-honesty`) stands on its own and is what stops
  files being mislabelled in the meantime.
- **OPEN — co-locate Canvas Size and Resize Layer in one toolbar area**
  (Chris, 2026-08-06: "maybe canvas resize and layer resize in the same toolbar
  area"). Worth knowing before designing: they are ALREADY one component —
  `LayerSettings.tsx` renders "Move or Resize Layer", Guides, and Canvas Size
  as three `show(section)` blocks, and the `section` prop is what splits them
  apart across surfaces. So this is likely a question of which sections render
  together in the Edit group rather than a move of code. Design call, Lacey's
  lane; explicitly deferred, not part of `fix/resize-layer-handles`.
- **NOTE — Resize Layer already targets the Review → Layers selection**,
  verified 2026-08-06 so nobody re-opens it: `onSelectLayer`
  (`AppShell.tsx:3373`) → `stamp.setActiveLayer` → `t.set_active_layer(id)`
  (`useLayers.ts:59`) sets `self.active`, and `begin_layer_resize_preview`
  clones `self.layers[self.active]` (`src/layer.rs:987`). No gap.
- **NOTE — AVIF stays in `EXPORT_FORMATS`** (Chris, 2026-08-06), so the export
  fix is the honest-size hint plus a runtime-detect path, not removal. See the
  export-size findings above; that work merges separately.
- **OPEN — find the source of the phantom records.** Candidates worth checking:
  a SESSION_LOG or night-plan file that records intent in the past tense, an
  agent summary written before its gates ran, or a hand-written brief carried
  forward without verification. This is the highest-value item in this section;
  everything above is a symptom.

## OPEN — drag-and-drop sometimes adds a duplicate photo (2026-08-07)

Reported by Chris, seen on **initial** drag-and-drop into an empty gallery.
Upload and paste are clean — neither goes near the window drop listener.

**NOT REPRODUCED.** Six attempts, all synthetic `DragEvent`s: 2 files with
photos loaded, 1 file with photos loaded, 1 file repeated, 2 files into an
empty gallery, and the full `dragenter → dragover → drop` sequence with the
drag overlay confirmed engaged. Every one added exactly the right number.

**What IS established, from code and from one live observation:**

`NewActions.handleDrop` (`features/upload/NewActions.tsx:183`) calls
`preventDefault()` but never `stopPropagation()`. The native event keeps
bubbling to AppShell's `window` drop listener (`AppShell.tsx:1894`), so a drop
**on the dashed dropzone** is handled twice. Observed live: both ran for the
same drop.

What the second handler does depends on the file count (`AppShell.tsx:1885`):

| Files | Window handler | Effect seen |
|---|---|---|
| 1 | `openImportDialog(files[0], files[0])` | photo added by NewActions **and** an "Add this image" dialog opens for the file already added. Answering "new gallery image" would add it twice |
| 2+ | `handleAddPhotos(files)` | should double-add — did not in any test |

A drop anywhere OTHER than the dropzone only reaches the window listener, so
one add. That asymmetry is a plausible "sometimes".

**To settle it, the next person needs a real OS drag** — a synthetic DragEvent
carries untrusted events, a different target under the cursor, and canvas
blobs instead of filesystem handles. Record: file count, photos added, whether
an "Add this image" dialog appeared, and whether the drop landed on the dashed
box or elsewhere.

**If confirmed, the fix is one line** — `e.stopPropagation()` in
`NewActions.handleDrop`. Not applied, because a fix for an unreproduced bug is
a guess.

A false start worth not repeating: I briefly called this confirmed off a photo
count of 5. That was a transient value read during the dialog's own render; the
settled count was 4 with no duplicates.

## Marketing nav glide — fix applied, mechanism verified (2026-08-09)

In the tree, uncommitted, alongside the button-set image work:
`marketing/src/styles.css` + `marketing/src/components/Nav.tsx`.

**Symptom.** Chris: "hover bar in menu is off again." Two phone shots: the bar
under "Architecture", caught mid-travel, renders as a left-dark → right-bright
gradient; the bar under "Trail Log", at rest, renders as a clean solid rule.

**Ruled out by measurement, do not re-litigate:**

| Suspect | Measured | Verdict |
|---|---|---|
| Horizontal misalignment | `dLeft` / `dW` = **0.000px** on all 5 links, at rest and hovered | not it |
| Bar tracks text box, not glyph ink | overhang 0.29 / 0.29 / −0.24 / 0.72 / −1.00 px | sub-pixel, not it |
| Sub-pixel rounding (the old v7.54-era bug) | rects already used, not `offsetLeft` | already fixed, still holding |
| `prefers-reduced-motion` | was `reduce` on Chris's Win11; he turned Windows "Animation effects" back on | separate issue, closed |

**Hypothesis behind the change (NOT proven).** The bar was `width: 1px` blown
up by `scaleX(var(--gw))` — up to 73x for "Architecture". An animating
transform promotes it to its own compositor layer, which is rasterized at the
element's layout size (1px) and stretched by the GPU; a stretched 1px texture
is a smear, which would explain soft-while-moving / crisp-at-rest exactly.
The change animates `width` instead. The bar is `position: absolute`, so this
lays out one 2px element and reflows nothing.

**Why it is unverified.** Chrome was never frontmost during the session. In a
backgrounded tab it freezes CSS animations *and* returns fallback `var()`
substitutions from `getComputedStyle` — the old build reported
`transform: matrix(0,0,0,1,0,0)` (scaleX **0**) while `--gw` was plainly `"35"`.
Any glide reading taken from a hidden tab is worthless; that trap cost a false
"regression" call mid-session. **Verify with the window actually in front.**

**If it turns out the smear was only phone-screenshot downscaling of a 2px
line, revert both hunks** — the scaleX version's geometry was never wrong.

### Verified 2026-08-09, partially — by the next session

The hidden-tab trap above is real and reproduced exactly: `visibilityState`
`"hidden"`, `getComputedStyle(glide).width` reporting **`0px`** while `--gw`
was plainly `"35px"`. That reading is a fallback substitution and must not be
trusted, exactly as this note warns.

What DOES survive it is `getBoundingClientRect()`, which reflects real layout
rather than a computed-style substitution. Against the built site on a fresh
port:

| Measure | Glide bar | "Home" link |
|---|---|---|
| left | 674.90 | 674.90 |
| width | **35.00** | 35.00 |
| height | 2.00 | — |

So the **mechanism is confirmed**: the bar is now a real 35px-wide element
rather than a 1px one scaled 35x, and its geometry still lands on the link
exactly. A forced screenshot also renders it as a clean solid rule at rest.

**Still not verified: the mid-travel frame** — the actual symptom. Animations
are frozen in a hidden tab, so nobody has yet seen the bar *while it moves*
under the new code. The hypothesis (GPU-stretched 1px texture) predicts this
fixes it, and the change is sound regardless, but the smear itself remains
unobserved-after. Worth one look with the window frontmost.

### Closed as far as measurement can take it, 2026-08-09 (third pass)

Geometry re-measured across **all five** links, not just Home. `transition:
none` first — otherwise a hidden tab freezes the transition at 0% and the bar
reads `width: 0` with an identity transform, which is the same worthless
reading that caused the earlier false regression call.

| Link | Bar width | dLeft | dWidth | Transform |
|---|---|---|---|---|
| Home | 35.00 | **0** | **0** | translate only |
| Architecture | 72.89 | **0** | **0** | translate only |
| Features | 51.97 | **0** | **0** | translate only |
| Pricing | 41.24 | **0** | **0** | translate only |
| Trail Log | 49.83 | **0** | **0** | translate only |

Max absolute error across all ten measurements: **0.000px**.

**The `anyScale: false` result is the one that retires the hypothesis**, and it
is categorical rather than a sample. `getComputedStyle(glide).transform` is
`matrix(1, 0, 0, 1, …)` at every stop — pure translation. The smear mechanism
REQUIRED a `scaleX` resampling a 1px-wide texture; a translation samples 1:1 at
every width and every point in the travel, so there is no frame at which the
old artifact could occur. This does not depend on catching the animation
mid-flight.

**What is left is a perceptual call, and it is Chris's to make, not a
session's.** The symptom was only ever reported from phone screenshots, and a
desktop Chrome at localhost cannot answer it. The relevant build is already
deployed: a local `pnpm run build:marketing` produces `index-wlAWpulG.js`,
the identical hash `image-horse.vercel.app` serves. So the check is "open the
live site on the same phone", with no local server involved.

If it still reads soft there, the remaining explanation is the one this note
already flagged — phone-screenshot downscaling of a 2px line — and both hunks
should be reverted, because the scaleX version's geometry was never wrong.

---

## ~~The third atomic-capture shape~~ — DONE v7.88

Closed same day. It was four sites, not two (`useCanvasActions` had two of its
own), all now on `capture_composite_excluding_background()`. Measured 3.45×
faster than the three-getter form. Details in ADR-024.

**~~One piece deliberately left~~ — DONE.** `useExportDimensions` now uses
`export_dims_excluding_background()`. Measured on a 1385×2068 document:

| Path | Time |
|---|---|
| two getters (old) | 39.9 ms |
| **dimensions-only (new)** | **17.4 ms** — 2.29× |
| `capture_composite_excluding_background()` + reading `.rgba` | 27.2 ms |

The third row is why the obvious reuse was wrong, and it is now measured rather
than argued: routing a caption through the pixel capture is faster than the old
pair and still 56% slower than asking for what you want, because
`getter_with_clone` copies ~11 MB you discard.

**⚠️ And the framing everyone had — including this note — was wrong.**
`useExportDimensions.ts` said it computed "the export dimensions shown on the
Share button". They are not shown. `exportDims` has exactly one consumer,
`<ShareButton canvasW= canvasH=>`, and ShareButton passes them to `createShare`,
which writes them into the Convex **`shares` table** (`schema.ts:192`).

So they are persisted share metadata on a public link, not a caption — which
makes the atomic-capture argument stronger, not weaker. A caption that is
briefly wrong self-corrects on the next render; a wrong width stored against a
share is wrong for the life of the link. Headers corrected in both the JS and
the Rust.

## `useExport` is four-fifths unreachable (found v7.88)

`useExport` returns five members. Only **`exportBlob`** has a caller.

| Member | Reachable? | Evidence |
|---|---|---|
| `exportBlob` | **yes** | `useCanvasActions.ts:166`, `AppShell.tsx:2888` |
| `exportPng` | no | `AppShell.tsx:2887`'s `exportPng={...}` is a *prop name* on `ShareButton`; its lambda calls `stamp.exportBlob("png")` |
| `exportAs` | no | already noted in `docs/Change-summary.md:3057` |
| `generateThumbnail` | no | — |
| `generateThumbnailUrl` | no | — |

**Do not delete on this evidence alone** — repo precedent (`useRealTier`) is
that a zero-reference export can be a missing wire. But this case is
distinguishable and the distinction is the useful part: `git log --all -G
"\.generateThumbnail"` returns **no commits at all**, so no caller was ever
lost. Supporting signals: `generateThumbnailUrl` emits JPEG q0.82 while the
entire gallery pipeline is WebP q0.78 (`lib/workingCopy.ts:6`), and the
`PhotoStrip` its comments name does not exist (the real strip is
`GalleryBar.tsx`). It is a spec awaiting a consumer.

The standing "zero-reference export" note in `Change-summary.md` therefore
undercounts this file: it is four of five, not one.

---

## ✅ RESOLVED v7.96 — `has_transparency()` cost a full composite, on every sync

**Found a5 (2026-08-09), fixed 2026-08-10 by DELETION, not optimisation.**
Nothing consumed the value: `CanvasArea` was its only reader and stopped gating
on it in `5e46921` (2026-06-27) when the checkerboard became unconditional CSS.
Removed from `UiStateCapture`; `has_transparency()` stays as a method.
Measured on the production build: `syncState` **30.9 ms → 0.0 ms**. None of the
three approaches below was needed. Kept for the record — and for the lesson,
which is to check for a consumer before designing a cache.

### Original entry

**Measured in the browser, production build, 1385×2068 document:**

| Call | Time |
|---|---|
| `get_image_data()` — the composite alone | 69.27 ms |
| `has_transparency()` | **61.91 ms** |
| The other **ten** `capture_ui_state` fields combined | **0.313 ms** |

One field costs roughly **200×** the other ten put together, and it is the only
one that is not a plain field read.

```rust
pub fn has_transparency(&self) -> bool {
    self.get_image_data().chunks_exact(4).any(|px| px[3] < 255)
}
```

`.any()` short-circuits, but `get_image_data()` does not — it composites every
layer into a full-document RGBA buffer *first*, so the scan's early exit saves
nothing. The composite is the whole cost.

**Where it lands.** `syncState` has **74 call sites** and calls this once per
sync. It is NOT per-frame: `usePaintTool` calls it at stroke END (mouse-up) and
its own comment is explicit that the per-frame path is untouched. So this is a
~60 ms hitch when you lift the brush, finish a layer operation, or undo — 
perceptible, not a dropped frame.

**Not introduced by a5, and not made worse by it.** Before: eleven reads, one of
which composited. After: one capture, still compositing once. Same cost, one
boundary crossing instead of eleven.

**Why it is not fixed here.** Engine work with its own correctness surface, and
a5's scope was the capture. Options, roughly in order of appeal:

| Approach | Note |
|---|---|
| Track transparency as engine state, updated on mutation | No composite at all; needs every mutation path to maintain it |
| Answer from layer metadata where it can | A single opaque full-bleed layer cannot have transparency; short-circuits the common case |
| Composite lazily, bail on the first transparent pixel | Still allocates; helps only when transparency appears early |

Same family as the exclude-background finding fixed in v7.88 — a getter that
recomputes a whole-document product to answer a small question — except this
one is on the drawing path rather than the export path.

---

## `useExportDimensions`' cancellation guard has no test (v8.6, 2026-08-11)

**What shipped.** ADR-024 Stage 3.5 made the effect's engine read an `await`.
An effect callback cannot be `async` — React reads the returned Promise as its
cleanup — so it became an async IIFE with a `cancelled` flag set by the
cleanup, and `dims.free()` on both paths.

**Why the flag matters.** The deps refire on every edit that can move the tight
bounding box. Behind the worker two composites can be in flight at once and
finish in either order, so without the flag a stale pair wins whenever the older
one lands last. These numbers are written to the Convex `shares` table, so a
wrong size is persisted against a public link and no later render corrects it.

**The gap.** The `await` itself is covered — the migration ratchet mutation-kills
a dropped keyword. The **guard is not**. Delete the `if (cancelled)` branch and
every gate stays green.

**Why it was not fixed in the same session.** There is no React hook-test
harness in this repo: no `renderHook`, no `@testing-library/react`, and the one
existing hook test (`useEffectiveTool.test.ts`) works only because that hook is
a pure function of its arguments. `useExportDimensions` holds `useState` +
`useEffect` and cannot be called directly. Closing this means either adding a
testing-library dependency — a trigger-level decision that wants an ADR and
Dara, not a 2am call — or hand-rolling a `react-dom/client` + `act()` harness in
jsdom, which is a first-of-its-kind piece of infrastructure for this repo and
deserves its own session.

**Also unverified in the browser.** The effect's async branch never ran during
the v8.6 check: it early-returns unless the exclude-background preference is on,
and no control for that preference was found on the export dialog or the tool
panels. Worth confirming that preference is still reachable from the UI at all —
if it is not, this effect is dead code in practice and the question changes.

---

## b1 / `primeTextMetrics` — the precondition is false (v8.10, 2026-08-11)

**Status: investigated, not built. Stop condition fired.**

The Stage 3.5 plan for `textMetricsCache.ts` rests on one claim in that file's
own header: *"Every call site below already tolerates a miss, because they all
had a fallback before this module existed."* Nobody had tested it. It is false.

| Call site | Kind | On a miss |
|---|---|---|
| `CanvasArea:2118` | render | ✅ JS-measured box centre |
| `CanvasArea:2288` | render | ✅ `sx - bgPad` |
| `useTextTool:251` | commit | tolerates — commits at the **uncorrected anchor** |
| `useTextTool:368` | re-edit | tolerates — the re-edit cycle **drifts** |
| `BatchSettings:1053` | batch | ❌ **throws by design**, skips the photo |
| `BatchSettings:1188` | batch | ❌ **throws by design**, skips the photo |

**And it would not even throw.** The miss path is
`Array.from(tool.measure_text(...))`. Once that returns a Promise, `Array.from`
yields `[]` — truthy — so `if (!m) throw` never fires, `m[0]` is `undefined`,
and the corner-align arithmetic produces `NaN` for every photo in the batch.
Verified in node. This is a truthy trap created *by the conversion*, inside a
JS caller, which `engine-call-audit.mjs` cannot see by construction — it lists
truthy traps at the engine call site, not ones the conversion creates upstream.

**The corrected shape.** Split by whether the caller can await, not by module:

| Sites | Fix |
|---|---|
| 2 render (`CanvasArea`) | `primeTextMetrics()` + existing fallback — the original plan, correct here |
| 4 non-render (`useTextTool` ×2, `BatchSettings` ×2) | **await the engine directly** — no miss, no drift, no skipped photos |

The three sites the audit counts are the `fill()` thunks *inside* the cache; the
work was always the six callers. Executing the original step 3 literally —
"remove the synchronous engine calls from the miss path" — ships the NaN batch.

**Why it was not built in the same session.** The plan's own stop condition says
to stop and report if this claim fails, and the corrected job is roughly twice
the size described (two call sites plus four caller conversions, in three
files). It wants a session with a full commit budget, not the last slot of one.

**When it is built, the acceptance test is arithmetic, not a green gate.** Type
text, commit, and confirm the committed position matches the preview to the
pixel — a2's own verification was predicted (503, 771) vs actual (504, 771). A
4px drift passes every gate in this repo.

- **ADR-024-F3 — build the autosave archive INSIDE the worker (filed v8.33,
  2026-08-13).** Signed-in autosave's `capture_state()` hands 29.5 MB of raw
  document across the port and keeps the engine busy for hundreds of
  milliseconds; v8.33's stroke gate schedules AROUND that cost, F3 removes it.
  Encode the SavedEdit archive in the worker — the PNG encode it already does —
  and return ~1–2 MB. Also shrinks the engine-busy window so a stroke starting
  just after a capture begins stalls far less. Touches `useEditPersistence`'s
  capture/`encodeArchive` seam and the detach-safety reasoning at
  `useEditPersistence.ts:390` — read that comment first; it explains why the
  capture must complete before any await used to matter, and the same argument
  needs restating for the in-worker version. Its own session.

- **ADR-024-F4 — record clone stamp / emoji / Magic Eraser in the op log
  (filed v8.35).** They are the unrecorded edits behind the fast-refresh data
  loss; v8.35's coverage-keyed 300 ms autosave is the mitigation, replay is the
  fix. Clone op is deterministic from (source, path, params). Emoji needs a
  pixels-vs-codepoint decision — b2's no-pixel-carrying rule applies. Engine
  work, own session, `rust-wasm-loop` gates.

- **ADR-024-F5 — worker blit is full-frame (filed v8.35).** The local path had
  dirty-tile flushes (`ih_tiles_flush`); the worker's `blit()` recomposites the
  whole document every frame. This is the likely residue behind "brush still a
  little slow" and "stamp slower than paint" after the v8.34 backpressure fix.
  Port the tile path into the worker blit; measure before/after with the
  hardware-rate stroke protocol.

- **✅ ADR-024-F6 CLOSED in v8.36 (same night, 2026-08-13 ~23:00) — all four
  links fixed, mutation-tested, acceptance-passed on BOTH engine modes.**
  What shipped, link by link: (2) the coverage check
  (`undo_count > oplog_cursor` ⇒ untrustworthy) committed with its 4 unit
  tests; (3) the race closed with a per-photo **invalidation epoch** —
  bumped synchronously on EVERY signal (dedup included), captured by
  `saveOplogInner` at its fire-time check, re-checked before the transaction
  (abort: nothing written at all) and after it (re-mark `stale: true` on the
  manifest the save itself just wrote — the only writer that provably can,
  since a dedup'd signal writes nothing and a racing one can be overwritten).
  Plus: an untrustworthy flush now DISARMS the pending debounce. 6/6
  mutations killed (3 TS gates, 3 Rust sites). (4) undo-0 root cause found:
  `undo_count`/`redo_count`/`history_labels` gated the log-cursor path on
  `layers.len() == 1` — the pre-ADR-016 predicate that counts the artboard
  Canvas — while `try_oplog_undo` uses Canvas-aware `oplog_in_scope()`; a
  restored artboard doc (hist deliberately cleared) reported 0 with the log
  ready to rewind. All three sites now use `oplog_in_scope()`, pinned by
  `restored_artboard_document_reports_its_log_depth_not_zero`. Acceptance:
  paint + stamp + 900 ms refresh → BOTH strokes survive, undo live, on
  worker AND `=0` (was: stamp gone, deterministic). wasm 774,688 → 775,604
  (+916 B, the inlined scope predicate ×3). The REAL fix remains **F4**
  (record these ops in the engine); F6's mitigations then become belt and
  braces. Original diagnosis kept below for the record:
  1. Clone stamp / emoji / Magic Eraser never touch the op log (`end_stroke`
     pushes history only; engine `oplog_broken` is set ONLY by snapshot-restore
     undo and layer changes — `lib.rs:702,1386` — never by the unrecorded edit
     itself, despite `oplog_is_broken`'s doc comment claiming otherwise).
  2. `isLogTrustworthy` tested only broken + multi-layer; its reason string
     said "unrecorded edit or multi-layer" from day one — the first half was
     never implemented. **A coverage check (`undo_count > oplog_cursor` ⇒
     untrustworthy) is now written, unit-tested and mutation-tested, SITTING
     UNCOMMITTED in the working tree** (`oplogPersistence.ts` + tests).
  3. **The check fires but LOSES A RACE**: the 2 s-debounced `saveOplogNow`
     armed by an earlier RECORDED edit rewrites the manifest `stale: false`
     after the invalidation marked it. The save path never consults the
     session `invalidated` set. IDB inspected at loss time: manifest
     `stale: false`, opCount 1 — while the **edits archive held undoStack
     length 2, both strokes, perfectly saved.** The data is written; restore
     discards it.
  4. Restore trusts the clean-looking log AND lands at undo 0 (not even the
     log's 1 replayed op) — the replay/undo-rebuild itself needs a look.
  The session's work: make `saveOplogInner` honor/re-check invalidation
  atomically (abort if `invalidated.has(photoId)` or re-verify trustworthiness
  inside the save), find why replay landed at undo 0, then the acceptance:
  paint + stamp + refresh at 900 ms survives on BOTH modes (the exact scripted
  repro is in session notes / memory). Vivek-lane; persisted-format wise this
  is flag-and-logic only, no schema change. The REAL fix remains F4 (record
  the ops in the engine).

- **Text tool — split the bounding-box handle semantics (Chris, 2026-08-13,
  re-confirmed 08-14).** His spec: add a NEW handle on the LEFT edge of the
  text bounding box that resizes the TEXT (font size); the CORNER handles are
  then reserved for actually making the BOX bigger (reflow area), not scaling
  the glyphs. "Use rust when you can" — the text metrics/layout already live
  in the engine (`build_text_annotation`, primeTextMetrics twins), so the
  size math and hit-testing belong engine-side; the JS keeps only the drag
  wiring. Its own session: handle rendering, hit zones, cursor feedback,
  and a QC pass on text reflow. ⚠️ Was reported "filed" on 08-13 but never
  actually written here — this entry corrects that.

- **Text reflow — corners resizing a REAL bounding box (filed from the
  2026-08-14 night session, Task 1).** The handle rearrangement shipped (left
  square-on-stem = font size; the eight font-scaling box handles removed), but
  corners cannot resize a box tonight because THERE IS NO BOX: `boxW`/`boxH`
  in the CanvasArea text overlay are derived from measured text each render,
  text wraps only at manual newlines, and no wrap width exists in the model.
  Two candidate designs, different costs:
  1. **Stored wrap width** (the real fix): `width` on the text annotation →
     TextParams, the annotation encode/decode in `ops.rs`, engine line-breaker
     (`ab_glyph` is already in the crate; `measure_text` exists via
     textMetricsCache) — a persisted-format change ⇒ **ADR + dexie-migration
     skill, not a night job**. Any new struct-returning measurement API must
     go through `lib/engine/captureMarshal.ts` or its contract test fails.
  2. **Commit-time newline baking** (cheap, lossy): corner drag computes a
     wrap width for the SESSION only, text is committed with hard newlines
     inserted. No format change — but one-way: widening the box on re-edit
     cannot tell user newlines from baked ones. Chris would notice. Decide
     awake, not at 1am.

- **Top bar left cluster overlaps the toggle group at 1000–1200px with both
  side panels open (found 2026-08-20, during the oval/sizing pass — PRE-EXISTING,
  not caused by it).** The bar is `grid-cols-[1fr_auto_1fr]`. At that width the
  panel gutters shrink the bar's inner box to ~532px, so each `1fr` column is
  ~130px while the left cluster's own content (Undo pill 84 + divider + Zoom
  pill 84 + two 12px gaps) is **193px**. Grid does not shrink it — it spills
  right, under the centre column, and the centre column is later in the DOM so
  it paints on top and takes the clicks.

  Measured on master with the component changes stashed, at 1100px, Tools +
  Review both open:

  | | master (before the oval pass) | after |
  |---|---|---|
  | Left column width | 130px | 143px |
  | Left cluster content | 193px | 193px |
  | Zoom ↔ toggle-group overlap | **38px** | **26px** |
  | `elementFromPoint` at Zoom-in's centre | **"New"** | **"New"** |

  So **the Zoom-in button is unclickable in that band** — the click activates
  New. The oval pass narrowed the centre pill (188 → 164) and therefore reduced
  the overlap, but did not remove it and was not its cause.

  The fix is a layout decision, not a size tweak: either drop the `1fr_auto_1fr`
  grid for a flex row that lets the centre move off-centre under pressure, or
  extend the existing `compact` collapse so the Undo/Redo pill (or the divider
  and gaps) also drops in the BP_TIGHT band, the way `narrow` already does.
  Both change where the toggles sit — Chris's call, not a passing edit.
