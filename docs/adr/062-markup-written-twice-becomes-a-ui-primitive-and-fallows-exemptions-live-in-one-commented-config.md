# ADR-062: Markup written twice becomes a ui/ primitive, and fallow's exemptions live in one commented config
Date: 2026-09-22   Status: draft

## Context
fallow on master: **2,938** duplicated lines, **13** unused files, **53** unused
exports. The copies had already drifted: Review's content box had lost the panel
shadow its two siblings carried, New Canvas labeled width/height with `<span>`s
instead of `<label htmlFor>`, and `master-bar/constants.ts` told the reader to
grep `top-[58px]` "and change all three". Eight of the "unused files" are
hand-run CLIs, and one of them is load-bearing: `guardrails.sh`, a blocking CI
job, runs `scripts/dead-exports-audit.mjs`.

## Decision
1. **Twice makes a component, three times makes a constant.** UI hand-written in
   two or more places becomes a component, usually in `components/ui/`. A class
   string or color literal repeated three or more times becomes a named constant
   in `lib/styles.ts`, or a module-local const when one file owns it. Applied:
   `select-field`, `status-note`, `pane-heading`, `confirm-dialog`,
   `number-field`, `segmented-tabs`, `swatch`, `ParkedScreen`, `HintTooltip` +
   `IconButton tooltip`; `PANEL_SECTION`, `BUTTON_PILL`, `WINDOW_TITLE`,
   `TILE_DISABLED`, `MASTER_BAR_CONTENT_BOX`, `SUBSYSTEM_COLOR`; seven shadcn
   tokens become `var()` aliases of the brand tokens whose hex they repeated.
2. **fallow's exemptions live in root `.fallowrc.jsonc`, each with a reason.**
   `scripts/*.mjs`, `scripts/*.js` and `tests/fixtures/**/*.mjs` are entry
   points; three marketing exports reached only through `import()` or
   `React.lazy` are ignored. No inline `fallow-ignore` comments.

Not aliased on purpose: `--primary`/`--accent` and `--ring`/`--border-active`
are equal today (`#c98f3f` light), but GeneralPane sketches a runtime accent
picker. Chris decided 09-22-2026: they stay separate tokens.

## Consequences
+ Pixel diff against master, 53 surfaces: identical except six intended changes
  (Batch font select is the Text tool's; Diagnostics tabs +2px with `role="tab"`;
  MasterBar tooltip `text-sm`; Dev Tests heading; Review box regains its shadow;
  saved-palette swatch drawn flat). Bundle −26.7 kB minified.
+ fallow: duplicated lines 2,938 → 2,824, unused files 13 → 0, unused exports
  53 → 0. A new exemption has one home and has to say why it exists.
- More small files, and one more hop to read a panel. The known trap is a
  primitive that grows a prop for one caller; `toggle-button-group.tsx` already
  says "prove the difference is real before adding the prop". GalleryCount's
  lightbulb stayed out of `InfoTooltip` because it needed three props for one caller.
  This branch already has two such props, kept on purpose: `Swatch`'s
  `label`/`removeLabel`/`title` (the color picker's accessible names) and
  `NumberField`'s `inputClassName` (the narrow channel boxes).
- Open branches that hand-edit the replaced markup conflict. PR #198 overlaps
  this branch in five files and conflicts in one, `SecurityPane.tsx`.
- `top-[58px]` is one copy now, not zero. It is still a literal mirroring
  `MASTER_BAR_CHROME_H` + 8, because Tailwind can't read a TS value.

## Alternatives rejected
- **Leave the copies** (duplication beats the wrong abstraction): they had
  already drifted, so they were costing correctness, not just lines.
- **Delete the "unused" scripts:** turns the blocking guardrails job red.
- **Inline `// fallow-ignore` comments:** scatters the exemptions.
  `dead-exports-audit.mjs` keeps its exceptions in one list with reasons for
  the same reason.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the rule was
applied by count, not by meaning. Two blocks that looked alike but did different
jobs got merged, one job changed, and the primitive grew a boolean for it, then
another, until `ConfirmDialog` or `NumberField` is a switch nobody wants to
touch, worse than the copies it replaced.
Early warning sign to watch for: a prop on a `components/ui/` primitive that
exactly one caller passes, or a `.fallowrc.jsonc` entry with no comment above it.
