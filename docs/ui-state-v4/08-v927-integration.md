# Next UI pass against v9.27

Date: 10-11-2026. Review branch: `ui/state-v4-v927`.

The seven-night document-state pass has been reconciled with the shipped v9.27
editor. This branch combines master `3bdee40c` and the original Night 7 head
`d7cbd664`. The seven original commits and draft PRs #328–334 remain intact.
This is review work; the live editor and release history still describe v9.27.

## Scope

The [seven audit records](07-audit.md) describe immediate photo-switch locks,
restored quality, Pen preview scheduling, opaque-layer Pins composition,
selection and mask ownership, recoverable save failures, and persistent async
errors. Those records describe earlier builds. The checks below cover the
combined branch on the current editor.

Four merge conflicts required review:

- Photo switching retains the v9.27 pending-adjustment commit before reading
  history and saving the outgoing engine document. Requested identity changes
  immediately, and the incoming document stays locked until loading finishes.
- The async-call ledger includes both sets of correctly awaited calls: 196,
  verified by the existing AST audit. Unsafe-call budgets stay unchanged.
- The gallery test retains v9.27's observer, which reads loading ownership and
  selection together in one browser frame and scopes marks to the gallery.
- UI consistency documentation retains both the shipped accessibility rules
  and the incoming document-state rules.

A new hook regression delays a pending adjustment commit and checks that the
incoming photo stays locked, no save or load starts early, and the outgoing
photo is saved after the edit commits. Removing the pre-switch commit makes
this test fail; restoring it passes. The current Settings fallback and gallery
keyboard fixes are included.

## Validation

- All 1,913 Vitest tests in 200 files pass. The new integration case was seen
  failing without the pending-preview commit and passing with it.
- All 54 selected production browser cases pass, with zero retries: rapid and
  delayed photo switches, interrupted strokes and adjustment commits, gallery
  loading and keyboard actions, import/resume previews, resize/quality/undo,
  masks, failed-save/refinement recovery, diagnostics, Settings and contrast.
- Desktop 1280×800, dock 900×900 and phone 390×844 pass in light and dark themes
  with reduced motion, real keyboard focus and no horizontal overflow.
- TypeScript, lint (zero errors, 53 existing warnings), unchanged guardrail
  budgets, production build, inert color audit (zero) and CSS optimizer warnings
  (zero) pass. The browser inventory includes all 55 eligible files / 146 cases;
  the complete default suite is left to the draft PR's CI.
- Rust formatting, all-targets clippy and tests pass with and without `tiles`.
  The tiles suite totals 689 passing tests. The rebuilt pinned WASM is
  893,715 bytes versus v9.27's 892,897 (+818 bytes), from the quality-capture
  footer and guarded opaque-layer Pins composition. Twiggy and a separate
  optimizer size check were recorded; the shipped build procedure is unchanged.

The stable browser run took 6.5 minutes. An earlier run was interrupted after
another gate rebuilt the served assets; its partial results are not counted.

Controlled WASM comparison: three warmups and 11-run medians, one fresh Node
process per pinned binary, after other builds and tests stopped. An earlier
comparison terminated while retaining both binaries and is not counted.

| Photo | Pins | v9.27 ms | Combined branch ms |
| --- | ---: | ---: | ---: |
| 1200×800 | 0 | 0.371 | 0.348 |
| 1200×800 | 1 | 11.512 | 1.897 |
| 1200×800 | 30 | 15.143 | 5.016 |
| 4000×3000 | 0 | 5.036 | 6.573 |
| 4000×3000 | 1 | 147.429 | 30.939 |
| 4000×3000 | 30 | 153.889 | 33.683 |

These measurements cover recomposition, not complete interaction latency. The
no-Pins path returns before the new branch; its timings are recorded as a
control, without a statistical performance claim. The original Night 3 report
contains the native translucent control and broader limitations.

## Release checks and limits

Run `imagehorse-qc` before release, including the live cloud/AI paths excluded
by the offline browser guard. This review does not publish a new version.

The already accepted [ADR-031](../adr/031-export-quality-lives-on-the-engine-snapshot.md)
dependency carries export quality in new captures and archives. Readers accept
older formats; records that never saved quality restore the legacy 75 default.
IndexedDB database versions, keys and indexes are unchanged. The operation-log
format, authentication and billing are unchanged.

The Pins fast path remains limited to opaque, unmasked, unstyled single-layer
documents. OpenRaster's underlying import still cannot be canceled after its
presentation timeout. The existing optional production analytics 404 recorded
in the v9.27 handoff remains a separate follow-up.
