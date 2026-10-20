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
