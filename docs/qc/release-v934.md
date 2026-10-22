# v9.34 release verification — 2026-10-20

Scope: annotation benchmark tooling and a feature-gated dirty-region prototype.
Normal editor builds exclude the prototype. No new editor controls or dialogs.

## Production-build QC

| Section | Result | Evidence |
| --- | --- | --- |
| Boot/import | PASS | Guarded logged-out production build initializes WASM; file-picker fixtures load. Desktop and phone import progress settles. Archived C1 drag-drop test imports a second photo and commits it to the gallery with no captured errors. |
| Editing | PASS | Shape creation, selection, duplicate/connect, delete, single-step undo, brush and Levels undo, A/B compare and three export naming cases pass. Six benchmark cases separately verify real pointer drags and undo in local/worker modes. |
| Buttons/dialogs | PASS for affected surface | Existing shape action bar and export dialog commit flows pass; pending-shape undo clears the overlay. The prototype adds no UI and is absent from the normal engine. |
| Persistence | PASS | Rotated shapes and Mono text restore pixel-identically after page reload; changing font changes actual pixels. |
| Accessibility | PASS | Settings keyboard navigation and surface contrast checks pass. No new interactive UI. |

Commands: selected editing/export/persistence specs (12 passed), archived
`qc-1014` C1 import spec (1 passed), import-skeleton and accessibility specs
(4 passed), plus desktop/phone no-key boot and settings checks (4 passed). Playwright uses a production bundle, placeholder backend keys and
the external-request guard. This is automated QC, not the still-pending human
Smart Brush test.

## Build and code checks

- 2,023 frontend tests in 220 files; 35 backend tests and deployment-check tests pass.
- 725 Rust tests with `tiles,dirty-regions`; seven prototype regression tests included.
- Formatting, all-targets Clippy, TypeScript and static guardrails pass.
- Lint: no errors, 52 existing warnings.
- Editor and marketing production builds pass.
- Default WASM: 901,943 bytes. Prototype is excluded from production.
- Eighteen engine benchmark cases have matching final pixels across paths.

## Release scope and service checks

README, dated history, Trail Log and architecture documentation explain the
experimental status. Home, Features and Pricing need no feature or price
changes: this release adds measurement tools, not an exposed editing feature.
Generated marketing data is refreshed against merged master history.

Before publishing, the latest master CI run passed. Vercel reported the editor
production deployment Ready, and the last 24 hours contained no returned error
logs. Production Convex `pastel-alligator-180` exposes all 14 expected modules;
a bounded log observation returned no errors. These are scoped observations,
not proof that every backend request succeeds.
