# Tool-UI arc — migrating every multi-mode tool onto the shared toggle

> Part of the [Image Horse](../README.md) docs. See also:
> [Refactor Playbook](Refactor-Playbook.md) · [Engine Roadmap](Engine-Roadmap.md) ·
> the `tool-module-migration` skill.

Every multi-mode tool adopts one shared presentation — icon-row on top, tool
title below, body swaps per sub-mode — and, in the same motion, registers as a
`ToolModule` in the registry. The UI is the visible payoff; the registry is the
architecture. Doing them together is the point: it turns the long-deferred
"kill the manual tool wiring" refactor into a series of shipped, visible wins.

**One tool per session. Verify on canvas, merge, then the next.** Do NOT batch —
a regression in one tool hides in the pile, and none of this is provable by a
green build.

## Where it stands

| Session | Tool | Status |
| --- | --- | --- |
| **2.0** | Shared `ToolModeToggle` extracted from **Paint** + the `ToolModule` type / `TOOL_MODULES` registry | ✅ **Shipped v7.19** |
| **2.1** | **Resize/Compress** → `[Compress] \| [Resize]` | ✅ **Shipped v7.22** |
| 2.2 | **Stamps** → `[Clone] \| [Emoji]` (+ red / batch if they're sub-modes) | ← next |
| 2.3 | **Text & Background** → `[Text] \| [Background]` | |
| 2.4 | **Shapes** → `[Shapes] \| [Pins] \| [Arrows]` | |
| 2.5 | **Logo/Batch** → `[Logo] \| [Text] \| [Rename]` | |
| 2.6a | **Edit & Transform** → rename to **"Adjust & Select"**, restructure, move the magic wand | |
| 2.6b | The **[Select]** sub-mode — the new selection tools | |

The reference implementation is **Paint** (`PaintSettings.tsx` consuming
`ui/tool-mode-toggle.tsx`). **Resize** (`ResizeSettings.tsx`) is the second, and
shows the pattern on a tool whose two bodies differ wildly in size.

Note on 2.2: the stamp-teardown fix and the "Clone Stamp" → "Stamps" rename
already shipped in **v7.18** — that session is now toggle UI + module
conversion only.

## What each session does

Apply `ToolModeToggle` to the tool and convert it to a registry `ToolModule`:

- Sub-mode state moves **into** the tool store, alongside the ones already
  there (`brushMode`, `stampSubMode`, `shapesMode`, `resizeMode`); the toggle
  only switches the body slot.
- **Do NOT change what a sub-mode DOES** — this is behavior-preserving
  re-presentation. Renames are display-label only.
- Register under the tool's **legacy id** (`brush`, `compress`, …). Tool ids,
  shortcuts, and persistence keys are load-bearing and stay put — see the
  known-tech-debt note in CLAUDE.md (ids don't match labels; they get renamed
  during the registry migration *only*).
- The **command palette picks the tool up for free**: `commands.ts` prefers
  registry modes once a tool has them, so the sub-modes become searchable
  Alt+, entries as soon as the module lands. Wire the sub-mode setter into
  `SUBMODE_SETTERS` and confirm the entries route correctly.
- Gates: `tsc --noEmit` + production build. Then **verify on canvas** — both
  sub-modes toggle by mouse *and* keyboard, every control in each body still
  works, nothing regressed.

## Session 2.6 — Adjust & Select (deliberately split in two)

The biggest one. Split so a sprawling session doesn't eat the arc:

**2.6a — rename + restructure + move.**
- Rename **Edit & Transform → "Adjust & Select"** (display label only).
- `[Adjust]` holds the current contents (Crop + Transform).
- **Move the magic-wand selection marker here, out of Resize Layer** —
  identical behavior in its new home.

**2.6b — the new selection tools, under `[Select]`.**
- **PatchMatch selection lasso — UI STUB ONLY.** Wire the button, mark the
  kernel TODO. The kernel is a separate, large Rust job that wants tiles +
  rayon; do not attempt it in a UI session or the whole arc stalls on a hard
  algorithm.
- **Magnetic selection by color range** (Photoshop-style).
- **Smart Brush + Magnetic Selection share ONE edge-detection core** (medium
  effort). Build the edge core **once** in Rust — a gradient/edge map over the
  image buffer — and both features fall out of it: the smart brush walks edges
  while painting, the magnetic lasso snaps to the same edges. The UI
  affordances land here; the edge core itself is engine work. Spec them
  together — see the pairing note in [Engine Roadmap §3](Engine-Roadmap.md)
  (§2 #1 Smart Brush, §2 #13 Magnetic Selection).

## Origin

Distilled from the WT2 night plan. The insight worth keeping: this arc
**quietly delivers the tool registry** — the biggest architectural gap in the
frontend — as a series of visible UI wins instead of an invisible refactor
nobody can see or verify.
