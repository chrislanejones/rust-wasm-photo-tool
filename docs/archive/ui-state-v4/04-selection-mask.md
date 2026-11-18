# Night 4 — Selection and mask session

Base: Night 3; master rechecked at f4dfd6c9.

Verified defects before modification: applying/removing a mask leaves the temporary maskEditing flag armed, although the panel hides its brush. The next stroke can recreate a mask unexpectedly. Refine previews survive leaving Select, while Selection → Mask uses the committed selection, causing preview ants and the created mask to disagree.

Fix the temporary session lifecycle against loaded engine state. Await accepted mask creation before arming its brush; do not arm on late completion after photo switching. Cancel pending previews when leaving Select or changing document, and restore committed ants before creating a mask. No selection algorithm, ADR-070, op-log or persistence change. Existing binary refinement versus Feather-to-mask labels and combine primitives remain in use.

Validation: 1,870 Vitest tests pass, including pending-preview cancellation, outgoing overlay suppression and invalid mask target cases. TypeScript, ESLint (0 errors, 54 warnings), guardrails and inert audit pass. Production build and all three refinement/mask Playwright cases pass (existing cases in the full run; corrected accessible-name case separately). Screenshot: test-results/state-v4-night4-mask.png. A restore error clears the unavailable overlay and stays visible; no new engine algorithm. Machine memory pressure temporarily prolonged a production build; the completed build and browser run passed.

Performance: cancellation is session-boundary work; mask strokes and selection algorithms are unchanged. Already correct: combine controls share primitives; Feather explicitly applies to mask creation; Hide/Reveal labels, mask thumbnails/cursor/status and exiting painting remain intact. Remaining async grammar consolidation and operation failure testing are Night 6's scope.
