# Night 5 — History and save outcomes

Base: Night 4; master rechecked f4dfd6c9.

Verified before modification: archive autosave failures only reach Diagnostics. The existing save publisher clears all failures on any successful original save or cloud backup, so saving Photo B hides failed edits for Photo A; a successful original encode can also hide A's failed archive. Magic Wand, marquee and lasso-close update the selection overlay without synchronizing history availability. Current history rows lack selected/current accessibility state.

Keep the existing runtime publisher, scoped by photo and save kind; clear only the failure actually resolved by a completed write. A refused ownership write must not move the saved point or clear a failure. Synchronize selection producers after completion and distinguish current versus alternative history accessibly. No op-log format, branching semantics, schema or billing/authentication changes.

Additional verified defect before modification: the switch continues after an archive save throws, replacing unsaved outgoing edits. Reuse the existing switch error/retry treatment, await any existing archive write, and refuse replacement if saving fails. Selecting the still-loaded photo resumes its intact document without reloading an older persisted copy. This is session control flow, with no storage architecture change.

Validation: all 1,877 Vitest tests pass; focused cases cover scoped failure recovery, refusal, rapid transitions around a pending failed save and returning to the unsaved loaded document. TypeScript, ESLint (0 errors, 54 warnings), guardrails, production build and inert audit pass. Four history-fork browser cases, all three selection/refine/mask cases, and the new injected full-disk save/retry case pass. Screenshot: test-results/state-v4-night5-save.png. Current history row has selected and current-step semantics; alternative timelines are named distinctly.

Performance: no extra per-pointer rendering; history synchronization runs after selection commits. Save serialization now waits for the existing write rather than skipping it. Existing history restore already refreshes document and selection controls; labels use available engine history metadata. Snapshot edits remain snapshots, without claims that they are replayable op-log operations. No history format or branch migration.
