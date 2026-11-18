# Night 3 — Canvas feedback and Pen/Pins latency

Base: Night 2, master verified f4dfd6c9.

Verified before modification: PenOverlay updates React anchors and reads canvas layout for every pointermove. Pins is labeled Pens in the shape mode selector and palette. WASM median recomposite on a 1200×800 opaque photo: no pins 0.36 ms, one pin 15.41 ms, thirty pins 16.72 ms. The first annotation disables the existing single-layer copy path and pays a full per-pixel alpha blend over transparent output. This cost is driven by photo area, rather than primarily by pin count. A 4000×3000 measurement is recorded below.

Engine dependency decision, before modification: extend the existing single-layer fast path only for provably opaque pixels, no mask/style, exact opacity 1. Render overlays as before, then copy the opaque result instead of blending it over an empty canvas. Verify byte parity against the generic compositor, including excluded translucent/masked cases. No new algorithms, APIs, snapshots, persistence changes, or allocation on brush-only fast paths.

4000×3000 baseline: 3.81 ms without pins; 122.51 ms with one pin; 127.77 ms with thirty. This reproduces the large-photo slowdown.

## Result and controlled measurements

After isolating generated artifacts and stopping competing builds, the same benchmark reads two distinct pinned binaries (before 886,178 bytes / 96825f247f22990c, after 886,553 bytes / 4f1dd39bc6730a89). 11-run medians, three warmups:

| Photo | Pins | Before ms | After ms |
|---|---:|---:|---:|
| 1200×800 | 0 | 0.223 | 0.268 |
| 1200×800 | 1 | 8.775 | 1.808 |
| 1200×800 | 30 | 11.250 | 4.878 |
| 4000×3000 | 0 | 4.604 | 4.780 |
| 4000×3000 | 1 | 109.716 | 22.421 |
| 4000×3000 | 30 | 141.782 | 25.837 |

Reproduce with scripts/pins-composite-benchmark.mjs against separately built pkg directories. Initial measurements above had concurrent test/build CPU contention; the controlled comparison supersedes them. Native Criterion shape cases also run; those use translucent base pixels and therefore intentionally stay on the generic path. No-overlay brush path is unchanged; its small timing difference is below machine noise and has no additional instructions.

Native translucent rotated-shape control, forced rebuilds and 30 samples after competing builds finished: before 3.8733 ms, after 3.7716 ms; Criterion reports no significant change (p = 0.83). Earlier concurrent timings were discarded.

PenOverlay updates its draft synchronously, publishes at most once per animation frame, and uses the already measured viewport for pointer coordinates. A regression test fails on the old code (200 React commits per 200 events) and now passes, including commit before a queued preview frame. The legacy pens mode ID remains compatible but is labeled Pins everywhere.

Validation: all 1,864 Vitest tests pass; TypeScript, ESLint (0 errors, 56 warnings), UI guardrails, production build and inert-class audit pass. Production Pins/Pen edit-and-undo test and both photo-switch brush tests pass. Rust tiles suite, clippy all targets and formatting pass; compositor parity test covers opaque/translucent/transparent data and a hidden edited path. WASM +375 bytes is the guarded opaque fast path. Screenshot: test-results/state-v4-night3-pins.png.

Limit: masked/styled/translucent and multi-layer documents retain generic composition; this is a measured opaque-layer slice, not a promise of 60fps on arbitrary documents. Mask brush distinction, clone-source feedback, transform handles and brush coalescing already exist and were preserved. No op-log format or persistence change.
