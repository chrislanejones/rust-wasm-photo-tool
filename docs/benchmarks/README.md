# Annotation rendering benchmarks

The experimental dirty-region renderer reduces engine rendering cost for the
tested annotation edits while preserving full-frame pixels. It is gated behind
the `dirty-regions` Cargo feature and is not connected to the editor's normal
flush path.

The browser uses an SVG overlay while dragging shapes and recomposes the engine
on commit. Its old `ih_tiles_flush` switch is no longer consumed. Engine
rendering speed and interactive drag latency therefore need separate
measurements.

## Engine results

The [WASM comparison](annotations-regions-comparison.json) contains 30 samples
after five warmups for each of 18 cases. Each case has a fresh Node process.
The fixtures mix rectangles, arrows, numbered pins and cached text on one
opaque layer. All three paths produced identical final pixels in each of the
six size/count combinations.

Median rendering time in milliseconds, including tile flush where applicable:

| Canvas | Annotations | Full frame | Tiled | Dirty region |
| --- | ---: | ---: | ---: | ---: |
| 1200×800 | 10 | 1.49 | 23.39 | 0.76 |
| 1200×800 | 100 | 7.35 | 27.51 | 2.35 |
| 1200×800 | 500 | 30.61 | 47.09 | 8.47 |
| 4000×3000 | 10 | 18.90 | 282.67 | 11.65 |
| 4000×3000 | 100 | 26.88 | 291.05 | 12.45 |
| 4000×3000 | 500 | 44.62 | 306.10 | 20.86 |

At 500 annotations, a shape update including its history snapshot and rendering
took 30.73 ms full versus 8.47 ms regional on the smaller canvas, and 51.75 ms
versus 23.97 ms on the larger one. History is cleared outside each timed sample,
so these memory results do not model a growing undo timeline.

The existing tiled API first recomposes the entire frame, then diffs and copies
tiles. It is a comparison path, not incremental rasterization. Direct
rectangle/arrow raster batch timings, recomposition timings, p95 values, memory
snapshots, base revision, binary hash and host information are in the JSON.
The prototype was measured with uncommitted source changes; the recorded commit
identifies its base revision, not a committed copy of the prototype.
Pin rasterization and cached-text blending remain part of recomposition.

The separate [native Criterion run](annotation-regions-native.txt) uses
rectangles only. Compare its full/regional pairs with each other, not its
absolute times with the mixed WASM workload.

## Browser drag measurements

[Browser results](browser-annotations/) cover 10, 100 and 500 annotations in
both local and worker modes. Each case imports a 1200×800 image, creates the
exact annotation count, reselects a shape, drags it through real pointer events,
verifies the committed geometry and checks undo.

The reported latency ends at the observed overlay DOM update and at the
following animation-frame callback. That callback is a rendering opportunity,
not a physical display presentation timestamp. Each step waits for the
observed update; the test measures paced latency rather than burst coalescing
or sustained frame throughput. Five warmups precede 30 recorded samples.

## Where the drag's 21 ms goes

Measured 10-21 on a 4-core Xeon container (Chromium 141, production build,
placeholder keys). v9.34's numbers came from Chromium 156 on another machine;
compare within one run, not across them. The harness now records when the
first `pointermove` listener runs (a window capture listener), which splits
event → DOM into the browser's input queue and the app's own work, and it
repeats the paced drag on an empty page whose one SVG rect is written straight
from a `pointermove` listener — the floor no overlay can beat.

Medians of 30 moves at 100 annotations, local engine, before the fix:

| | Unthrottled | 4× CPU |
| --- | ---: | ---: |
| Event → first listener (input queue) | 7.5 | 8.8 |
| First listener → overlay DOM (the app) | 13.7 | 83.7 |
| **Event → overlay DOM** | **20.7** | **93.8** |
| Empty-overlay floor, event → DOM | 6.8 | 12.0 |

The suspects, in the plan's order:

- **Waiting for a requestAnimationFrame: no**, not in the app. The input
  queue is ~7 ms because Chrome dispatches continuous input aligned to frames;
  the empty overlay pays it too. Nothing in the app can remove it.
- **React re-rendering more than the overlay: yes — the whole 14 ms.** Each
  move called `useDrawingTools.updateEditGeometry` → `setEditState`, state that
  lives in AppShell, so every move re-rendered AppShell and everything under
  it that is not memoized: 70 React commits for 35 moves. A `pointermove`
  update is a continuous-priority render, so it ran in a task after the event
  (30 of 30 moves) and the DOM write landed after the frame the event belonged
  to. Moving the same geometry through a store only the two overlays read
  took the app's share from 13.7 to 1.4 ms with nothing else changed, which is
  the attribution.
- **Geometry per shape: no.** Flat across 10/100/500, as v9.34 found.
- **The harness: partly.** The floor is ~7 ms unthrottled. The plan's "under
  8 ms event → DOM" bar is only just above it, so the app's own share
  (first listener → DOM) is reported beside it.

The fix (lib/liveEditGeometry.ts): a drag writes its geometry to a small
external store that only the edit box and its action bar subscribe to
(`useSyncExternalStore`). An update from an event listener is a sync-lane
render, so the box is written inside the event's own task. React's edit state
catches up once, on release, in the same commit that empties the store, so
nothing jumps back. Enter or Escape mid-drag take the in-flight geometry with
them. The engine was not touched during a drag before and is not now.

After, same run, same harness ([before](browser-annotations-2026-10-21/before/),
[after](browser-annotations-2026-10-21/after/)):

| Annotations | Mode | Event → DOM before | after | App share before | after | 4× CPU before | after |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | local | 21.8 | 5.9 | 13.0 | 1.3 | 80.4 | 18.3 |
| 100 | local | 20.7 | 5.7 | 13.7 | 1.4 | 93.8 | 17.1 |
| 500 | local | 21.4 | 6.4 | 14.1 | 1.3 | 90.3 | 18.9 |
| 10 | worker | 23.0 | 5.0 | 12.6 | 1.6 | 95.6 | 17.0 |
| 100 | worker | 23.6 | 6.1 | 14.8 | 1.5 | 82.4 | 18.7 |
| 500 | worker | 21.3 | 5.9 | 14.2 | 1.3 | 100.9 | 18.0 |

Event → following frame opportunity went from ~25 ms to ~6 ms (100, local):
the write now lands before the frame instead of after it. The input queue
also shrank (7.5 → 4.1 ms) because the main thread is free when input
arrives. At 4× CPU the app's share is still ~7 ms; most of what is left is
both overlays reading the canvas rect, which a later pass could cache for the
drag. The Corner-radius dot still writes the panel's tool settings per move
and so still re-renders the editor; it is not on this path.

`e2e/shape-drag-stays-out-of-react.spec.ts` checks the property rather than a
clock: every move's DOM write must land before a message posted from the
first listener, so a drag routed back through AppShell state fails it on any
machine.

To reproduce: `ANNOTATION_BROWSER_CPU=4` throttles the page through DevTools,
and file names gain a `-cpu4` suffix.

A minimal `width()` call measures the local/worker round trip. Main-thread
JavaScript heap usage is reported separately; it excludes worker heaps, WASM
and GPU memory. Node results report WASM allocated capacity and process RSS,
not exact live allocations.

## Prototype contract

`AnnotationRegionPrototype::new(tool)` establishes a correct full cache and
allocates one persistent RGBA scratch canvas. The caller supplies a rectangle
covering **all old and new ink** for each change, including stroke and shadow
extents. Unknown damage and changes outside that rectangle require a full
recomposite. This is an explicit-damage prototype, not automatic invalidation.

The scratch buffer retains original canvas coordinates to preserve existing
rasterizer rounding. Only damaged rows are restored and copied back. Shapes
and cached text are drawn in their original stacking order; pins are not culled
because tiny pin labels can extend beyond the disc.

The regional path supports one visible, opaque, unmasked layer, basic
unrotated shapes with no fill or solid fill, and cached text tiles. Multiple
layers, masks, layer styles, transparent base pixels, transformed or unsupported
shapes, previews, changed dimensions and invalid rectangles use the full-frame
fallback. Eligibility currently scans base alpha on each call.

Scratch retains 3.66 MiB at 1200×800 or 45.78 MiB at 4000×3000. WASM capacity
did not grow beyond the full-path capacity in these runs because the allocator
reused space previously occupied by temporary full-frame renders; that does not
make the persistent scratch free.

Before production integration, add mutation-driven invalidation, full
invalidation for document changes, and coverage for all currently unsupported
rendering styles. Measure continuous interaction and run imagehorse-qc.

## Validation

Seven native prototype tests cover partial updates, translucent overlap,
fractional coordinates, cached text shadows, clipping, deletion, hiding,
undo, operation recording and fallback states. Default and feature-enabled
Rust suites, Clippy, formatting, TypeScript, lint and guardrails pass. Lint
retains 52 existing warnings and no errors.

The final six browser cases run against a production build using the normal
engine, with the prototype export absent. The default WASM remains 901943 bytes.
Enabling `dirty-regions` produces a 904816-byte WASM, an increase of 2873 bytes
for the experimental renderer and its bindings. No default rendering path or
frontend interaction was changed.

## Reproduce

Run timing commands sequentially with other builds and tests stopped:

```sh
IH_WASM_FEATURES=tiles,patchmatch,dirty-regions pnpm run build:wasm
ANNOTATION_BENCH_PATHS=full,tiled,dirty pnpm --silent run bench:annotations > /tmp/annotation-regions.json
cargo bench --features tiles,dirty-regions --bench annotation_regions -- --warm-up-time 1 --measurement-time 1

# Restore the normal engine before measuring the editor.
pnpm run build:wasm
ANNOTATION_BROWSER_BENCH=1 ANNOTATION_BROWSER_OUTPUT=/tmp/annotation-browser PW_PORT=4967 pnpm exec playwright test e2e/annotation-performance.spec.ts --workers=1
```

The browser harness builds and serves the production app with placeholder
backend configuration and blocks external requests. It is opt-in and does not
add machine-dependent timing thresholds to CI.

The [original baseline](annotations-baseline.json) is retained separately.
Differences between independent runs include ordinary host timing variation;
use the full/tiled/regional pairs in one comparison run.
