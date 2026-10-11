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

## Night 11: Sharing

Master still `315e857f`; reviewed async rules, exceptions, sharing tests and
ADR-063 (share limits remain server-owned). A local browser harness mounted the
real ShareReady and LinkCard with held image responses, without a live backend:
both rendered undecoded images and zero skeletons before the fix. Public image
failure had no useful message. SharedPane already handled native load errors;
that behavior was retained and now recovers when a signed URL changes.

Changes: retain the viewer's loading feedback through decode; one status during
query loading; dimensioned image frame, explicit error and Try again; per-preview
loading/error state in the list. Preview requests remain deferred until near the
viewport. All use the existing thumbnail loader and Skeleton.

Files: ShareViewer.tsx, SharedPane.tsx, their tests, this report.
Validation: 17 focused Vitest tests pass, including deferred preview fetch,
renewed URL recovery and unchanged share actions. Browser harness verified two
skeletons, failure, successful retry and identical image-frame bounds, with
light/dark loading and ready screenshots. TypeScript and guardrails pass;
ESLint has zero errors (existing warnings). No backend, authentication, share
limits or mutations changed. Query data supplies dimensions; the pre-query
placeholder cannot know an image's aspect ratio. No baseline increases.

Night 10: commit 8ae47ea9, PR #340.

## Night 12: Batch grid

Master unchanged. Reviewed ADR-079, the gallery loader and Batch exception tests.
Browser probe confirmed all 11 non-active thumbnails could remain undecoded
without any placeholder. Removed the separate all-photo object-URL cache;
each mounted page tile now reuses useThumbImage, with unchanged dimensions,
a 300 ms grace period, error fallback and last-decoded-image retention.
The hero canvas is outside this component and stays visible.

Files: GridThumbnails.tsx and its new component test, batch-crop-frame browser
test, this report.
Validation: 11 focused unit tests pass; browser probe shows 11 placeholders,
stable failure frames and working exception selection, in light/dark at
1000×800. Four existing Batch Playwright tests pass (crop scopes, shared
selection, rename exceptions, grid count). TypeScript, lint (existing warnings)
and guardrails pass. Unit tests also cover pagination, retained selection,
photo updates, active-photo changes and clamping after deletion. Only visible
page thumbnails allocate URLs/probes, instead of every photo in the gallery.
Per-image status does not make the canvas or list inert. No ratchet increases.
The broader remote suite exposed a crop-test selector tied to the replaced
title tooltip. It now locates the thumbnail by accessible name; both crop-frame
regressions pass, including drag, Shift-drag, thumbnail shading and Crop All.

Night 11: commit cd320838, PR #341.

## Night 13: Photo identity

Master remains v9.26. Confirmed the gallery repeated its total as both sides of
"12 of 12". It now reads "12 photos · 12 max" (singular supported); selection
still reads "Selected: 3 of 12". Tools keeps the active-photo identity.

Audit: CapturedState v1 and SavedEdit contain no export quality. AppShell seeds
the preference, then follows engine undo/redo. ADR-031's archive work and draft
#329 propose persistence changes; changing only the UI seed cannot restore a
value that was never saved. Deferred that dependency explicitly. Guide positions
are not persisted and are cleared on photo switch; guide color is already a
persistent app preference, covered by existing tests. No persistence migration.

Files: GalleryCount.tsx and test, UI_CONSISTENCY.md, this report.
Validation: 10 focused tests pass (count and guide preferences); 4 gallery
browser regressions pass at compact/wide/phone widths with light/dark screenshots.
Caption stays in its footer without changing gallery geometry. TypeScript,
lint (existing warnings) and guardrails pass. Plain text clarifies identity;
no processing, photo state, keyboard behavior or runtime cost changes.

Night 12: commit cdeb0c50, PR #342.

## Night 14: Component library and accessibility

Master unchanged; read UI exceptions and ADR-062. Browser tests first failed on
missing Settings tablist and measured low-contrast tokens. Extended the existing
segmented-tabs primitive (no second rail component): vertical orientation,
roving focus, wrapping Up/Down, Home/End and linked tabpanel. Settings keeps its
existing selected-tab store and all pane actions. Retired its raw-button exception.

Measured muted text minima: light 3.00 → 4.68:1; dark elevated 4.10 → 4.79:1.
Shortcut headings now use secondary text, 6.99:1 light / 8.56:1 dark.
Before/after compact Settings screenshots retain the layout with clearer helper
text. Both themes reviewed. Shared loading markup in four surfaces is now
`ui/decoded-image`, a presentation wrapper over useThumbImage and Skeleton;
resource-specific recovery stays with each caller. Lazy previews remain lazy.

Files: MediaTile, ShareViewer, SharedPane, GridThumbnails, SubscriptionButton,
ui/decoded-image, ui/segmented-tabs and its test, styles.css, the Night 14 and
Night 2 e2e specs, UI_EXCEPTIONS, UI_CONSISTENCY, guardrails, this report.
Validation: 20 focused component tests and 5 browser tests pass; TypeScript,
ESLint (existing warnings) and guardrails pass. Counts tighten to spacing 41,
raw buttons 13; radius stays 22. No added dependencies or loading state machine.
Risk: muted text is a global token; tested its documented surface combinations,
not every possible composited color throughout the app.

Continuation (2026-10-10): remote CI found the ORA and plugin test helpers still
looking for Settings buttons. Both now address the named tabs, preserving the
real import/export and plugin assertions and the Settings accessibility contract.
All seven focused ORA, plugin, Settings keyboard/contrast and control tests pass.

Night 13: commit 636583a3, PR #343.
