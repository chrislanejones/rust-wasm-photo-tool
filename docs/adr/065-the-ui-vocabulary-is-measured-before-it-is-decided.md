# ADR-065: The UI vocabulary is measured before it is decided, the instrument is not the gate, and every exception is registered
Date: 2026-09-23   Status: draft

## Context
The design vocabulary had never been counted, only asserted. Measured on
`master` at v8.90, 09-23-2026: **82 distinct spacing values across 713 uses** in
91 files — the worst ratio of any family — and **81 values used exactly once**
across every family. Night 1 of 7 arrived with a proposed spacing scale,
`4 6 8 12 16 20 24 32`, written from memory rather than from the tree. One of its
steps is wrong for this codebase; a step it leaves out is used more than that one;
and a third nobody proposed is in real use and has to be retired on purpose.
Survey: [UI_INVENTORY.md](../UI_INVENTORY.md). Rules:
[UI_CONSISTENCY.md](../UI_CONSISTENCY.md). Registry:
[UI_EXCEPTIONS.md](../UI_EXCEPTIONS.md). **No component, class or baseline
changed tonight.**

## Decision
1. **The vocabulary is chosen from a count, not from taste.**
   `scripts/ui-inventory.mjs` is read-only: it greps `app/src` and prints a
   histogram per family of visual value (heights, spacing, radii, icon sizes,
   type, z-layers, raw colors, arbitrary px). The canonical set is then picked
   from what the code already does, and every step in it can name the count that
   earned it. The measurement **overruled the proposal in two places**: `5` /
   20px was proposed and is out at 19 uses, while `0.5` / 2px was omitted and is
   in at 24 — more used than the step that displaced it; and `2.5` / 10px has 27
   real uses (`py-2.5` ×13 the bulk), retired deliberately rather than
   unknowingly. R1's eight steps carry 656 of 713 uses today. Radius came out
   sharper than "pick a house style": resolved against the shipped CSS,
   `.rounded{border-radius:.25rem}` is a hardcoded Tailwind default and
   `.rounded-xl{border-radius:var(--radius-xl)}` reads Tailwind's own theme
   variable, so R3 forbids both rather than choosing between them.
2. **The instrument is not the gate.** The script reports; `guardrails.sh`
   ratchets; tonight it only reports. ⚠️ A grep reads text, so it cannot tell a
   class from a comment about a class — and the survey proved that on itself,
   three times. Two histogram values were words in sentences that emit no CSS:
   `rounded-square` (`GalleryBar.tsx:266`) and `z-1` (`PenOverlay.tsx:612`). Then
   the a11y count did it again an hour after the caveat was written:
   `aria-pressed` was reported as **21**, because `rg -c` counts lines containing
   the string and eight were comments — two inside `tool-button-group.tsx`,
   explaining when the attribute is emitted. Counted as `aria-pressed={` it is
   13, and **one of those 13 is still prose** (`MasterBar.tsx:93`, a JSX comment
   quoting `aria-pressed={active ?? false}`), so the real figure is **12 in 12
   files**. One question, three answers, two corrections, one cause. CI has gone
   red on the same shape twice before: `role="button"` inside an explanation of
   the `role="button"` rule, and "as any other dependency" read as an `as any`
   cast. A rule graduates to a ratchet at Night 7 **only if a grep can check it
   without going red on a sentence** — R1, R3 and R7 qualify; R5, R6 and R9 need
   a parser or a human. The script's own defense is anti-vacuity, because a zero
   from a broken regex looks exactly like a zero from clean code: it refuses to
   run unless ripgrep matches a token in a file it just wrote, and every family
   carries a probe literal from the tree — a family that cannot find its own
   probe prints `VACUOUS` and exits 1.
3. **Every exception is registered, and the annotation beats the file
   exclusion.** `UI_EXCEPTIONS.md` opens seeded from the exclusions already living
   inside `scripts/guardrails.sh`, where nobody reads them, with no reason and no
   expiry — and an exclusion with no reason is indistinguishable from a bug that
   was quieted. A same-line `// allow: <check>` annotation is preferred: a file
   exclusion covers code not yet written, an annotation dies with the line it
   excuses. ⚠️ Measured, of the six `raw-colors` file exclusions **three hide zero
   violations today** (`CanvasArea.tsx`, `PenOverlay.tsx`, `lib/colors.ts`), and
   all six files exist on disk — which matters, because a missing file produces
   the same zero and means the opposite thing. The arithmetic closes exactly: 22
   with the exclusions + 7 `GalleryBar` + 2 `CompareSlider` + 1
   `MagnifierOverlay` = **32 with none, measured**. And the `allow: raw-color`
   hatch has existed since the check was written and is used **0 times in
   `app/src`** — every tolerated raw color is tolerated by the blunter instrument.

## Consequences
+ A canonical value can be argued with, because it has a number. Type needed
  nothing at all (8 sizes, 282 uses, three carrying 95%) — worth knowing only
  because it was counted rather than assumed.
+ Reading `guardrails.sh` closely enough to document it surfaced two free
  tightenings sitting on the floor: `rust-panics` 46 against a baseline of 47,
  `librs-lines` 4763 against 4808. Not taken — a docs branch does not quietly
  edit the blocking CI gate — and recorded for whoever next opens the script.
- **The highest-value defect found is deliberately not fixed tonight, and
  measuring it made it wider than the component that led to it.**
  `ui/toggle-button-group` documents itself as independent toggles ("multiple may
  be on at once") while **12 of its 14 call sites** across 9 files are exclusive
  choices; `PARKING_LOT.md` already had that as an API smell at "9 of 11 callers",
  counted before v8.85–v8.90 added three panes. New tonight is the accessibility
  half, and it does not stop at one component. All 14 sites emit no `aria-pressed`
  and no `aria-checked`. `tool-button-group` does emit `aria-pressed={opt.active}`,
  **deliberately only for tiles carrying their own `active`** — sound reasoning,
  stated in its doc comment: "a plain action is never announced as 'not pressed'".
  The side effect is that a SELECT tile, lit from the group's `value` and never
  setting `active`, announces nothing either, and `tool-mode-toggle` passes
  `value={activeMode}`, so the wrapper inherits the silence rather than the
  attribute. Across all 43 segmented-control call sites: **2 emit `aria-pressed`**
  (`RulersGridsPane`, `LayerSettings`), 3 are ACTION rows where silence is right,
  and **38 are silent and should not be** — 24 `ToolButtonGroup` SELECT sites plus
  all 14 `ToggleButtonGroup` sites. So the settings surface, including the Sync
  switch shipped in v8.85 and the privacy switch in v8.89, reads to a screen reader
  as rows of unrelated stateless buttons. WCAG 2.1 AA. ⚠️ The survivor needs the
  fix too, and the two primitives that get it right, `radio-cards` (native inputs)
  and `segmented-tabs` (`role="tab"`), are the least used in the table at 1 and 2
  importers. Night 2.
- **78 of 221 radius uses bypass the house tokens** and no check notices:
  `rounded` (60) and `rounded-xl` (18) resolve to Tailwind defaults, not
  `--radius*`, and `rounded` duplicates `rounded-sm`'s 4px by a different route —
  64 uses over two spellings of one number, the 60-use spelling being the one that
  ignores the tokens.
- Three documents now have to be kept current and nothing recomputes them;
  retiring 10px and 20px is 46 call sites someone has to move; and R1 covers 92%
  of spacing today, not 100%. A class-based count is also blind to raw CSS —
  `styles.css:1598` gives the bare `kbd` element `border-radius: 3px`, off-scale
  and invisible to this instrument and to `inert-class-audit.mjs` alike.

## Alternatives rejected
- **Adopt the proposed scale and migrate the code to it:** it would have retired
  2px (24 uses) while keeping 20px (19) — more code moved, for a worse fit.
- **Make the inventory a blocking gate immediately:** it reads text, and the
  survey's own counts needed correcting for prose three times — the histogram's
  `rounded-square` and `z-1`, then `aria-pressed` 21 → 13, then 13 → 12 while
  this ADR was being written. A ratchet that goes red on a sentence is the failure
  this repo has already documented twice, not the feature.
- **Leave the `guardrails.sh` exclusions undocumented where they are:** an
  exclusion with no reason cannot be told apart from a quieted bug, and three of
  the six turned out to be protecting nothing.
- **Fix the a11y gap in the same change:** the measurement moved it from one
  component to 38 call sites across both segmented primitives, including the one
  the survey just named the survivor. That is a component change on a survey
  night, touching every settings pane. It gets its own night.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the three
documents became the record of one night rather than the state of the app. Every
number in them is stamped v8.90 / 09-23-2026, the script is deliberately not in
CI, and re-running it is nobody's job — so the survey ages into a plan, and the
next person measures again from scratch rather than trusting it. The second way
this goes wrong is the rules never reaching the code: R1 is at 92% coverage, so
every rule is aspirational for the remainder, and a rule with no ratchet and no
owner loses to whatever the next component happens to do. The sharpest version of
that is already sitting in the Consequences: a measured WCAG 2.1 AA defect on 38
call sites, written down and assigned to "Night 2", which is a date only if Night
2 happens. A survey that files a real defect under a night number and stops is how
a known bug becomes an old bug. The third way is Night 7 arriving, a candidate
ratchet going red on a comment, and someone raising the baseline to get green —
which is the one move `guardrails.sh` exists to prevent.
Early warning sign to watch for: a number in `UI_INVENTORY.md` that
`node scripts/ui-inventory.mjs` no longer prints, a new `-g '!**/…'` in
`guardrails.sh` with no row in `UI_EXCEPTIONS.md`, or any baseline in that script
going up.
