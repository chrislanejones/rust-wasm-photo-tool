# Night 1 — Photo switching readiness

Base: master `f4dfd6c9` (v9.22), verified against origin before work. This isolated worktree includes no unrelated checkout changes.

## Actual defects

Requested identity moved only after the outgoing save. An original-file load was fire-and-forget, missing originals returned silently, same-photo requests could not retry, and the per-photo panel unlocked after 15 seconds regardless of readiness. Generic engine-ready timers could end a new load. Canvas input was blocked only after the delayed veil appeared. Status mask, selection and undo readouts exposed outgoing document values.

## Before / after

Selection now moves immediately, while outgoing persistence uses the engine owner. Original and archive loads are awaited; the engine UI snapshot settles before committed-document revision advances. Action-time guards block canvas, keyboard and history mutations immediately. Gallery navigation remains available. Readouts use the loaded-document invariant, delayed skeletons keep their layout, and failed loads remain recoverable through the gallery and a persistent retry notification.

Decode/restore has no measured percentage: the top indicator is now delayed and indeterminate. Existing global preferences and component styling remain in place.

## Evidence

- Missing-original regression observed failing when the original silent return was restored, then passing with the fix.
- Complete Vitest suite: 183 files, 1,849 tests passed; additional keyboard dispatch regression verified separately.
- TypeScript, ESLint (errors-only), UI guardrails, production build and inert-class audit passed. Existing lint warnings and build chunk warnings remain; baselines unchanged.
- Production Playwright: photo-switch cue/state/paint/leftover suites, including requested-versus-loaded readouts, rapid switching, edited archives, pointer input during switching and reduced motion.
- Screenshot: `test-results/state-v4-night1-switch-complete.png` (generated artifact, not source).

## Performance and limits

No pointer-movement React updates or Rust changes. Readiness adds an awaited UI snapshot at document-load boundaries. The drawing path is unchanged except for one imperative admission check at pointer-down. Pending strokes still finish through the existing stroke gate. Failed-load cases are covered at the session hook boundary; broader async failure injection and full device audit follow in later nights. Engine hangs still require recovery outside the serial queue; elapsed time never makes an unresolved document editable.

CI regression follow-up: the gallery loading assertion also matched the new status-bar working mark. Scope it to gallery thumbnails and observe its owner/selected state in one browser frame. Compare import skeleton layout dimensions instead of an animated thumbnail transform. All six focused gallery/import browser cases pass on this Night 1 branch. These shared test corrections are included from Night 1 so each stacked PR can pass independently.
