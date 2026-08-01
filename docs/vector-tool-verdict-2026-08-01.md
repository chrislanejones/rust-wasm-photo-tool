# `feat/vector-tool` — merge or delete

Measured 2026-08-01 (NIGHT JOB IV). The branch was not merged and was not
modified; every number here comes from a throwaway copy (`test/vector-rebase`)
so nothing published was rewritten.

**One-sentence verdict: the work is sound and self-tested but decaying, the
reconciliation cost is real and growing, and it does NOT fix the shape-colour
bug — so nothing should be waiting on it.**

## What it is

One commit, `38275af`, 2026-07-27: *"wip(vector): merge Shapes into Text as one
'Vector' tool, six sub-modes"*. 27 files, +696/−227. It adds
`features/tools/vectorGesture.ts` with its own `vectorGesture.test.ts`, and
reworks `ShapeSettings.tsx` (+64/−20), the tool registry, routing and the
sub-tool row.

Position against master: **1 ahead, 38 behind.** (An earlier note in this repo
said "38 ahead" — that was the columns read backwards. It is not racing ahead of
master; it is rotting behind it.)

## Does it still build? Yes — cleanly

Checked out at its own base, dependencies installed, engine rebuilt:

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `pnpm run build:wasm` | succeeds |
| production build | succeeds |
| `vitest run` | **241 passed, 18 files** |
| `pnpm lint` | **0 errors**, 59 warnings |

So the branch was left in a working state, not abandoned mid-break. (Master runs
309 tests across 24 files; the branch has fewer simply because it predates 38
commits of new tests.)

## Does it rebase? Yes, but not cheaply

`git rebase master` onto a copy: **16 conflicted files, 29 conflict hunks.**

| File | Hunks |
|---|---|
| `app/src/features/routing/routes.test.ts` | 4 |
| `app/src/app/AppShell.tsx` | 3 |
| `app/src/app/useKeyboardShortcuts.test.ts` | 3 |
| `app/src/features/commandPalette/commands.test.ts` | 3 |
| `app/src/features/routing/routeState.test.ts` | 3 |
| `app/src/features/routing/routes.ts` | 3 |
| `app/src/lib/styles.ts` | 3 |
| `useKeyboardShortcuts.ts`, `SubtoolRow.tsx`, `ToolButton.tsx`, `ToolGrid.tsx`, `TextSettings.tsx`, `toolModes.ts`, `persistence.test.ts` | 1 each |
| `app/tsconfig.tsbuildinfo` | modify/delete |
| `docs/Features.md` | content |

The conflicts are not incidental. They land almost exactly on the files the
five-group toolbar arc and the v7.61 AI Rename sub-tool also touched — the tool
registry, the sub-tool row, routing, and their tests. **Every future change to
tool-registry files adds to this bill**, and lately most changes touch them.

One conflict is already resolved by time: `app/tsconfig.tsbuildinfo` is a
tracked build-cache that has caused merge trouble before. Master has since
stopped tracking it; the branch still carries it, so it shows up as
modify/delete and can simply be dropped.

## Does the shape-colour bug exist there? Yes — untouched

This was the reason to look. A placed square or circle cannot be recoloured, and
the working theory was that the Vector rewrite might already have addressed it,
making a fix on master dead code.

It does not. `app/src/hooks/useDrawingTools.ts` is **byte-identical between
master and the branch** — `git diff master feat/vector-tool -- <that file>`
returns zero lines. Both blockers survive there exactly as on master:

- `es.style?.strokeColor ?? s.strokeColor` (line 268) and the matching
  `fillColor` at 282 — the reselect snapshot outranks the live panel, so a
  panel change can never reach the commit.
- `editDirtyRef` (line 302) is only ever set by a handle drag (line 534), so a
  colour-only edit hits the `if (!editDirtyRef.current) … return` early exit and
  never calls `update_shape_annotation` at all.

The branch reorganises the Shapes **UI** (`ShapeSettings.tsx`) and leaves the
**commit path** alone. So the fix belongs on master, independently, and is not
blocked by this branch.

## Recommendation

Salvageable, and worth salvaging — the design work is done, it is tested, and
`vectorGesture.ts` is real logic with its own tests. But the reconciliation cost
only grows, and it is already 29 hunks across the most-edited files in the repo.

Either schedule the rebase-and-finish as its own session soon, or delete the
branch and keep `vectorGesture.ts` as the salvage. What should **not** happen is
another month of drift, and nothing should be held back waiting for it —
including the shape-colour fix, which it does not contain.

Not merged, per instruction: a `wip(` commit does not go to production
unattended.
