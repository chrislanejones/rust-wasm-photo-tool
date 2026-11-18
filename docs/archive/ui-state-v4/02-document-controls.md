# Night 2 — Document controls and verified persistence dependency

Base: finalized Night 1. Origin master remains `f4dfd6c9` (v9.22).

## Verified defects, before modification

The per-photo quality seeding effect writes the outgoing draft into the incoming engine. Resize Reset captures its baseline when requested identity changes, before the restored state arrives. Histogram reads can sample an outgoing document and late results can mutate the target after cancellation. Resize measurement has neither a readiness guard nor a committed-document cache key.

Production regression: Apply quality 70 on checker, switch to sky-building, Apply 50, return to checker. Quality returns as 75. Both saved edit and snapshot records omit quality, and the archive encoder is still v5 despite accepted ADR-031 specifying v6. This fails the requested document restoration and undo acceptance criteria.

## Dependency decision

Complete the already accepted ADR-031 quality fields: current and snapshot quality in the atomic engine capture, optional fields in existing local edit values, and backward-compatible archive v6 decoding. The existing snapshot-injection API captures the engine's current quality, so restore can set that value before each injected snapshot without a new engine API. No IndexedDB key/index/schema migration, no op-log format or branching changes. The atomic transport gets its own version 2; readers retain version 1 support. This is the verified engine/persistence dependency permitted by the plan, documented before implementation.

Broader persistence redesign remains outside scope. Older records lack quality and restore the existing engine default of 75. Lost values from old archives cannot be reconstructed.

## Result and evidence

Controls now synchronize from committed document revisions; temporary slider drafts remain local. Reset uses engine quality, Apply uses the displayed draft, and histogram/size measurements discard canceled or outgoing-document results. Undo and restored snapshots preserve their own quality. Resize dimensions remount on committed revision.

Validation: TypeScript passed; ESLint 0 errors (56 existing warnings); all 1,863 Vitest tests passed; production Playwright resize placement and two-photo quality/undo regression both passed. UI guardrails and inert-class audit passed without higher budgets. The awaited-call ledger records three new correctly awaited restoration setters; unsafe-call budgets did not change. Screenshot: test-results/state-v4-night2-quality.png.

Pinned WASM build: 885,731 → 886,178 bytes (+447, 0.05%), explained by the capture quality footer. No pointer/drawing path changed; capture adds one integer per snapshot. v1 capture and v5 archive compatibility, corrupt v6 footer rejection, disabled Apply and late-save ownership are covered. No auth, billing, IndexedDB schema, or op-log format change.
