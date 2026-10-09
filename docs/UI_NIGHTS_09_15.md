# UI Nights 9–15

Run against master `315e857f` (v9.26), 2026-10-09. Each night is a separate
stacked branch and draft PR; review and land in order. No merges or deployments.
Evidence: `/home/clj/ai-repo/ui-night-evidence/`. Original checkout and its
untracked files are untouched. Browser TMPDIR is on disk because `/tmp` is full.

## Night 9: Gallery

Confirmed on master: docked 1000×800 rows overlap; hovering bar padding reveals
all thumbnail controls. Reused the narrow gallery changes and layout test from
existing draft #317, leaving its unrelated fixes out. That PR overlaps this one.
The loading test also queried marks outside tiles and read a transient state
across several driver calls. It now observes one atomic DOM sample on the tile.

Changes: max-content grid rows scroll instead of squeezing; named tile/bar
hover groups; scoped loading observation; adapted existing keyboard-focus
contract tests. No gallery or photo-switch state-machine changes.

Files: GalleryBar.tsx, Thumb.tsx, accessibleNames.test.ts,
gallery-loading-state.spec.ts, gallery-tile-layout.spec.ts, this report.

Validation: 8 Playwright tests pass (1000, 1280, 390 widths and loading
G0–G3); 48 focused Vitest tests pass; TypeScript, ESLint and guardrails pass.
An initial full unit run found only two source-contract assertions for the
old unnamed group; both were updated and passed. Screenshot comparison:
compact tiles previously covered the lower portion of the preceding row;
afterward each square has full spacing and the gallery scrolls. Light/dark
screenshots recorded for all three sizes. No baseline increases.

Accessibility/performance: keyboard focus still reveals controls; only the
hovered tile reveals pointer actions. CSS-only product changes add no runtime
work. Remaining risk: overlapping drafts #317 and #319 should be reconciled
at review; this branch does not include their other changes.

## Night 10: Welcome Back

Master remains `315e857f`; rechecked rules, exceptions and async ADR-081.
Browser reproduction held restored thumbnail URLs: both boxes stayed empty.
Resume also formerly rendered from effect-created URLs, so its initial render
omitted the photo tiles. Rendered-component coverage confirms the stable count.

Changes: MediaTile uses the existing useThumbImage hook; Resume renders by photo
identity immediately. The hook accepts existing URLs as well as owned blobs,
uses useDelayedFlag, waits for actual decode, and terminates stalled loading at
15 seconds. Previously decoded pixels survive updates and superseded callbacks
are ignored. Icons/count tiles are unchanged; no new presentation primitive.

Files: MediaTile.tsx and its test, ResumeContent.tsx, useThumbImage.ts,
resume-image-loading.spec.ts, this report.
Validation: 41 focused tests pass, including existing gallery tests; browser
hold/failure test passes, with identical card bounds and usable Resume action.
Light/dark screenshots show skeletons where the baseline had blank boxes.
TypeScript, ESLint and guardrails pass. Each thumbnail has one loading status;
error has a named image fallback and directs users to Resume. No new animation,
no image-processing changes, no ratchet increase. Browser tests use synthetic
network failure; they do not claim a real user's stored thumbnails are corrupt.

Night 9: commit f648e0f9, PR #339.
