# UI Nights 9–15

Run against master `315e857f` (v9.26), 2026-10-09. Each night is a separate
stacked branch and draft PR; review and land in order. No merges or deployment commands.
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


## Night 15: Regression and cleanup

Final master inspection was still `315e857f`. Reviewed the rules, exceptions,
parking lot and ADR-071 before the regression pass. Two edge cases were exposed
and fixed with tests first seen red:

- Independent media deadlines could compete with the existing gallery cap.
  Timeout is now opt-in: DecodedImage requests 15 seconds; gallery/mobile tiles
  retain their existing region deadline, logging and recovery.
- A renewed signed image URL remounted a share preview. Keys now follow resource
  identity, so decoded pixels remain until the renewed URL decodes. Retry still
  deliberately remounts an attempt; changing the share token changes identity.

Coverage adds decode rejection, late completion after timeout, StrictMode URL
ownership and unmount cleanup, gallery deadline ownership, refreshed share URLs,
30× CPU observation, and both OS/app Reduce Motion. Updated the screenshot
harness for the named gallery group. The first Reduce Motion assertion checked
animation-name; the existing CSS hides the pseudo-element with display:none.
Corrected the test to check visible motion, without changing that working CSS.

Files: useThumbImage and Thumb tests; DecodedImage and its new test; ShareViewer
and SharedPane with tests; gallery-loading-state, gallery-skeleton-harness and
resume-image-loading browser tests; PARKING_LOT and this report.

Final validation:

- **188 Vitest files / 1,861 tests pass.**
- **33 Playwright tests pass** across gallery, imports, Resume, Batch, Settings,
  keyboard controls, fast-load flicker, off-screen images and failure recovery.
  This includes two crop-frame tests rerun after remote CI exposed the old
  tooltip-based selector; the fix is folded into Night 12 and all later PRs.
- Real-component browser probes for Shared and Batch also pass loading/failure/
  recovery checks, with light/dark screenshots and unchanged frame bounds.
- TypeScript, ESLint (zero errors, 55 pre-existing warnings), build, guardrails
  and inert-class audit pass. Inert color utilities: 0. Rust formatting, Clippy
  and the tiles-enabled Rust tests pass through the repository pre-push hook.
- Ratchets: spacing **41**, radius **22**, raw buttons **13**; none increased.
- Gallery frame watcher: **0** loading/skeleton frames on cached restore and
  during edit thumbnail regeneration. Card and chrome bounds match before,
  during and after loading at 1280, 1000 and 390 px.

Before/after visual evidence lives in `/home/clj/ai-repo/ui-night-evidence/`.
Untouched-master screenshots in both themes reproduce compact overlap; fixed
screenshots show separated square tiles. Resume, Shared and Batch replace their
verified blank waits with the existing skeleton, then end in decoded content or
failure at stable dimensions. Settings retains its layout with readable muted
text. The original loading-test flake did **not** recur in three additional
master repetitions; its broad selector and multi-read timing hazard are removed,
and the replacement passes at 30× CPU. This run does not claim a measured new
flake rate from that small sample.

Accessibility/performance: one status per independent image region, no lingering
status after failure, the gallery keeps its single aggregate announcement;
keyboard selection and reduced-motion behavior pass. No new dependency or image
processing path. Batch allocates only mounted-page resources; Shared previews
remain deferred until near view. All transient URL resources are cleaned up.

Remaining work: review the stacked PRs in order and reconcile overlap with #317
and #319. Export quality and guide-position persistence, trash/purge and real
per-photo cloud state remain explicit separate dependencies. No backend,
authentication, billing, Rust/WASM processing or unrelated work was changed.

Night 14: commit 260f8662, PR #344. Night 15 is branch
`ui/night-15-regression`; its final commit and PR are in the handoff.


## Continuation: tests, marketing and draft overlap (2026-10-10)

The two stale Settings selectors are fixed in Night 14 and inherited by Night 15.
Marketing /features now describes stable Welcome Back/Batch/Shared previews,
per-tile gallery controls and keyboard Settings navigation with readable help
text. The canonical feature list, README and pending-review changelog agree.
Derived Trail Log squares still count master only; no unmerged work is presented
as a release, and the release log stays at v9.26.

Overlap review against the current remote draft branches:

- #317 and Night 9 have identical gallery row sizing and named hover-group fixes.
  When landing #317 after this stack, omit its GalleryBar/Thumb/accessibleNames
  changes and reuse the Night 9 layout spec (which also captures both themes).
  Preserve #317's separate resize, shape-commit and Rust hit-test fixes.
- #319 and Night 9 both fix tile-scoped loading observations. Retain this stack's
  MutationObserver-based G1/G3 assertions and readiness waits when landing #319;
  omit its older driver-polling version. Preserve #319's CI coverage expansion,
  drag readiness checks, archived specs and CSS warning gate.

Both drafts remain open for their independent work. No PR was merged and no
deployment was requested.

Continuation validation: seven focused tests pass on Night 14; five pass on the
final Night 15 stack (eight distinct ORA/plugin, keyboard/contrast, control and
Resume scenarios). App TypeScript, ESLint (0 errors, 55 existing warnings),
guardrails, editor production build and marketing typecheck/client/SSR/prerender
build pass. The marketing browser preview shows the updated cards without page
errors. The live editor mounts its upload input without page errors, the engine
sentinel passes tier 1 (tier 2 explicitly skipped without a CI expectation), and
all 30 live skip-link targets pass. Evidence logs and screenshots are alongside
the original evidence. Native pre-push checks run for the remote updates.
