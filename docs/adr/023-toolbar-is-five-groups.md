# ADR-023: The toolbar is five groups of sub-tools, not a flat tool list
Date: 2026-07-30   Status: draft   Records: v7.51–v7.53 (shipped)

Written after the fact. The decision was made and shipped across v7.51–v7.53;
this records it because it changed the app's primary navigation, is expensive to
reverse (URLs, keybindings, muscle memory), and had been carried only in session
notes.

## Context

The toolbar was a flat row of eleven tools, each with a bare-key digit (`1`–`9`,
then `0`, then `-` for the eleventh). That numbering had already run out once —
the eleventh tool got `-`, which collided conceptually with `Alt`+`-` for zoom —
and the tool count was still climbing. Every new tool was a fight over a key.

The flat list also flattened genuinely different things. "Compress" and "Clone
Stamp" sat as peers, and the panel below the rail had to be a union of every
tool's controls. Tool ids had drifted from their labels years earlier
(`arrow` = Layer Settings, `emoji` = Batch, `crop` = Edit/Transform), which the
flat list made invisible: nothing forced the id and the label to be reconciled
because nothing grouped them.

## Decision

Five top-level groups — **Enhance, Select, Create, Edit, Batch** — each owning an
exclusive set of sub-tools. 34 sub-tools at the time of writing.

- **Digits `1`–`5` select the GROUP.** There is no second digit axis. Sub-tools
  are reachable by click, by URL (`#/create/pen`), and through the command
  palette (`Alt + ,`). `6`–`0` and `-` are freed.
- **One registry is the single definition site**: `features/tools/toolGroups.ts`.
  ToolGrid, SubtoolRow, routing, the command palette, ShortcutModal and the
  per-group canvas dispatch all DERIVE from it. Derived-or-nothing is the rule.
- **A sub-tool carries its own stable id**, rather than being derived from
  `(tool, mode)`. 27 of the 34 are uniquely identified by that pair; six are not
  (Crop / Transform / Colour Picker all resolve to `crop` with no mode; Resize
  Layer / Canvas Size / Guides all resolve to `arrow`), and deriving identity
  would light those tiles three at a time.
- **Legacy tool ids are load-bearing and are NOT renamed here.** A sub-tool is a
  view onto an existing `(ToolType, mode)` pair. Persistence keys, `TOOL_BY_KEY`,
  route aliases and the whole of AppShell still speak the old ids. Renaming
  happens during a tool's own registry migration and at no other time.

## Consequences

- The digit axis stopped being a scarce resource. Adding a sub-tool costs a
  registry row and nothing else.
- **Everything derived from the registry stopped drifting — and everything not
  derived from it kept drifting, visibly.** ShortcutModal was migrated to derive
  and immediately stopped omitting Select. The status bar was NOT migrated and
  went on advertising the old digit table for six releases: `#/edit/crop` told
  users to press `2`, which is Select. Fixed in v7.58 by deriving it too. The
  pattern is now explicit: a second copy of the tool table is a bug in waiting.
- The one-panel-per-tool union got smaller, but AppShell did not shrink — the
  restructure moved navigation, not logic.
- URLs became meaningful (`#/create/pen`), which is what made per-sub-tool
  deep-linking and the palette's 45-entry index possible.

## Alternatives rejected

- **Keep the flat list, add letter keys.** Would have bought one more release of
  headroom and made the keymap unguessable.
- **Two digit axes (group digit + sub-tool digit).** Rejected: 34 sub-tools do
  not fit one digit row either, and a two-key chord for the most common action
  in the app is worse than a click.
- **Derive sub-tool identity from `(tool, mode)`.** Rejected on the measured
  six-collision case above.

## Pre-mortem

- *Six months from now this is regretted because…* the group boundaries turn out
  to be wrong for how people actually work — most likely Create, which holds 13
  sub-tools and is the obvious candidate to split. Mitigated by the registry: a
  regrouping is a data change, not a refactor.
- *…or because* the legacy-id deferral never gets paid off, and the repo carries
  two vocabularies (`emoji` = Batch) indefinitely. That debt is now visible in
  one file instead of scattered, which is the best that could be done without a
  rename storm.
