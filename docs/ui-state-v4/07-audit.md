# Night 7 — State audit and regression protection

Base: Night 6; master rechecked f4dfd6c9. Prior work is included through the stacked branches, with no merge/deploy.

Verified before modification: obsolete loadProgress/finishImageLoad and their completion timer remain in useUIStore without production consumers. The remaining startImageLoad call only needs the existing isImageLoading setter. The route mirror writes a canonical hash on every store notification, including selection coverage and loading; this can overwrite an external hash before its hashchange event runs. Browser checks reproduced intermittent Layers navigation loss during selection synchronization.

Remove unused loading machinery and make route publication depend on an actual change of routable state. Add runtime regression tests for requested versus loaded identity, incoming hash ownership, reduced-motion status, themes and supported layouts. Reuse the existing readiness hook and measured guardrails; no new baseline or visual exception.

Additional verified defects: the generic loaded-document accessor can expose an explicitly unready engine state when identities match; reject it. Lasso draft arrays outlive a photo switch; end the existing engine session and discard its outgoing wire and pending movement replies. This uses existing session cancellation, without a selection algorithm change.

Diagnostics also paired the requested photo's name with the outgoing canvas dimensions
and allowed a pending canvas hash to outlive that ownership. Current Image Meta now
uses the loaded-document accessor and existing PerPhotoRegion. Its component lifetime
is scoped to photo, dimensions and history position, so old captures cannot replace
the current document's readouts. Global Resources/Telemetry/Flags tabs remain available.

## Validation and regression evidence

- Complete Vitest suite: all 1,888 tests in 192 files passed, including both
  diagnostics cases and all document-readiness cases.
- TypeScript, ESLint (zero errors, 53 existing warnings), guardrails, production build
  and inert-class audit (zero) passed. No lint or guardrail baseline was raised.
- Four new regression cases fail against Night 6's original code and pass with the
  fixes: matching-but-unready document, stale lasso wires, incoming route overwritten
  by non-route notifications, and outgoing diagnostic dimensions/late hash.
- Production browser audit covers rapid and delayed switching, pointer edits during
  switching, edited-photo restoration, resize/apply/undo quality, Pins/Pen editing,
  refine/apply/undo, masks, history forks, injected full-disk save failure/recovery,
  ZIP, OpenRaster, import skeletons, gallery marks, settings focus/Escape, reduced
  motion, logged-out demo and phone engine deferral. See the execution record below.
- Desktop 1280×800, dock 900×900 and phone 390×844 run in light and dark themes.
  Real Tab focus never enters an inert region, no horizontal page overflow, and
  loading announcements name the committed photo. The phone viewer remains a
  browsing/download surface with the covered editor inert.

Browser execution: the initial 53-case audit passed 45 cases. Its eight failures
were test assumptions, corrected without changing application behavior: a gallery
selector also matched the status bar; import geometry compared a scaled entrance
animation instead of its layout footprint; light theme has no `.light` class;
navigation was attempted before import finished; and a phone's covered canvas remains
mounted. Focused reruns passed all eight plus the related gallery/import/refine/focus
checks. Final audit adds a real-browser diagnostics ownership regression, and all
seven final audit cases pass. There are 54 distinct passing browser cases across
the complete audit and focused reruns. No case
was skipped and no retry configuration or timeout baseline was raised.

Already correct and retained: existing visual identity and primitives, delayed 300 ms
loading convention, mask thumbnail/cursor, clone source indication, transform handles,
brush coalescing, batch outcome counts, AI request ownership and settings sync states.
The eight canvas geometry reads remain registered; unrelated document readouts have
no new exception. The new zero-tolerance `legacy-photo-loading` guardrail prevents
obsolete completion-timer fields returning to useUIStore. Route publication caches
only the last derived hash and does not introduce a second route store.

CI follow-up: the broader browser job in the service-worker workflow failed only
the same gallery-marker selector assertion on earlier nights (Night 1: 76 passed,
one failed; Night 6: the same assertion). The correction and import layout measurement
are placed in Night 1, where all six focused cases pass, then included through the
rebased stack so every PR can pass independently. The final application/test source
is identical to the validated audit; only ancestry and audit documentation changed.

## Seven independently reviewable slices

Each branch contains its predecessor, each night has a separate commit, and each
draft PR compares against that predecessor. Nothing is merged or deployed.

| Night | Record | Draft PR | Result |
| --- | --- | --- | --- |
| 1 | [Photo switching](01-photo-switch.md) | [328](https://github.com/chrislanejones/rust-wasm-photo-tool/pull/328) | Immediate document lock, truthful delayed loading, stale completion/retry protection |
| 2 | [Document controls](02-document-controls.md) | [329](https://github.com/chrislanejones/rust-wasm-photo-tool/pull/329) | Quality draft/commit/undo/restoration agreement, histogram ownership |
| 3 | [Canvas feedback](03-canvas-feedback.md) | [330](https://github.com/chrislanejones/rust-wasm-photo-tool/pull/330) | Pen updates once per frame; opaque-layer Pins composite about 5× faster at 4000×3000 |
| 4 | [Selection and masks](04-selection-mask.md) | [331](https://github.com/chrislanejones/rust-wasm-photo-tool/pull/331) | Refinement session teardown and valid mask editing target |
| 5 | [History and saves](05-history-save.md) | [332](https://github.com/chrislanejones/rust-wasm-photo-tool/pull/332) | Save failures preserve recoverable edits; actual current history position |
| 6 | [Async feedback](06-async-feedback.md) | [333](https://github.com/chrislanejones/rust-wasm-photo-tool/pull/333) | Persistent errors, timeout ownership, duplicate submission protection, measured ZIP packaging |
| 7 | This audit | [334](https://github.com/chrislanejones/rust-wasm-photo-tool/pull/334) | Readiness/routing/lasso/diagnostics regression protection and visual evidence |

## Screenshots

Nightly evidence:
[switching](evidence/state-v4-night1-switch-complete.png),
[quality](evidence/state-v4-night2-quality.png),
[Pins](evidence/state-v4-night3-pins.png),
[mask workflow](evidence/state-v4-night4-mask.png),
[save failure](evidence/state-v4-night5-save.png),
[refinement failure](evidence/state-v4-night6-error.png).

| Layout | Light | Dark |
| --- | --- | --- |
| Desktop | [Light](evidence/state-v4-night7-desktop-light.png) | [Dark](evidence/state-v4-night7-desktop-dark.png) |
| Dock/tablet | [Light](evidence/state-v4-night7-dock-light.png) | [Dark](evidence/state-v4-night7-dock-dark.png) |
| Phone viewer | [Light](evidence/state-v4-night7-phone-light.png) | [Dark](evidence/state-v4-night7-phone-dark.png) |

Visual review preserves the existing palettes, spacing, controls and layout. The
current-document name, dimensions and quality agree across both desktop themes and
the dock; the phone viewer identifies the same imported photo. Browser focus rings
and accessible names remain in place. Reduced motion disables refinement spinner
animation and skeleton shimmer, while keeping static feedback visible.

## Performance and remaining limits

Night 7 does not change the canvas pointer hot path or Rust. Night 3's separately
built WASM comparison and native control measurements are recorded in its audit;
the native control found no significant timing change (p = 0.83). Pen's previous
200 React commits for 200 pointer events are reduced to at most one per frame.

Night 2 required a verified quality archive/capture dependency, documented before
the Rust change. Old archives that never recorded quality necessarily restore the
legacy 75 default. No IndexedDB schema or op-log format was changed. Night 3's fast
path applies only to opaque, unmasked, unstyled single-layer documents; other cases
keep generic composition. OpenRaster has no underlying cancellation API and may
finish after its presentation timeout. Live cloud/AI services are excluded by the
offline browser guard; those integrations require the existing release QC. Rust
checks were run for Nights 2/3, with a fresh 390-case tiles suite subsequently
verifying the complete source; Nights 4–7 do not change Rust. Run imagehorse-qc
before the next release. No authentication or billing behavior was changed.
