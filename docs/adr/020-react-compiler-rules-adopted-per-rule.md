# ADR-020: The React Compiler rule set is adopted rule by rule, and the imperative ref layer stays
Date: 2026-07-22   Status: **Accepted (2026-07-22)** — evaluation pass on
`chore/react-compiler-rules`; the six fixes are `e88a0d8`, and
`eslint.config.mjs` is byte-identical to master (this ADR is a decision
about the gate, not a change to it).

## Context
v7.42 (`5621471`) wired the repo's first real ESLint gate.
`eslint-plugin-react-hooks` 7.1.1 no longer ships the two classic hook
rules as its recommendation: `recommended-latest` is the React Compiler
rule set — **17 rules, 14 of them `error`** (counted from the plugin's
exported config). Run over `app/src` at `5621471` through a probe config
it reports **123 problems, 66 errors**: `refs` 35, `set-state-in-effect`
18, `purity` 10, `static-components` 2, `preserve-manual-memoization` 1,
plus 57 `exhaustive-deps` warnings. Adopting it wholesale fails the gate
on 66 errors in code with no known bug. The pass fixed 6, declined 32,
and flagged 28 as investigated-but-not-touched.

## Decision
Adopt per rule, never as a set.
- **Now, as `error`:** `static-components` (2 violations, both fixed, repo
  at zero — it stays there for free) and `purity` (10 hits in 2 files,
  both with a correct fix: `CelebrationDialog.tsx:71-83`'s 9 ×
  `Math.random()` inside `useMemo(fn, [])` becomes `useState(fn)`, which
  *is* guaranteed once-per-mount; `ResourceMonitor.tsx:175`'s `Date.now()`
  moves into the state the tier-1 poll already drives).
- **Hold:** `react-hooks/refs`. The diagnosis is right but 31 of 35 hits
  are one deliberate idiom (below); gating today means 31 suppressions,
  which is worse than no rule. Gate only after a `useLatestRef` /
  `useEffectEvent` migration run under `imagehorse-qc`. `useEffectEvent`
  is stable in the installed React 19.2.7 (typed in `@types/react`
  19.2.17, `index.d.ts:1791`), and two sites — `ImageGuidesOverlay`'s
  `onMoveRef`, `useStampTeardown`'s `clearsRef` — are textbook fits
  because the ref holds a function called from an effect.
- **Do not gate:** `set-state-in-effect` — highest count, lowest signal;
  15 of 18 are free or correct, so adopting it buys 15 `eslint-disable`
  comments on correct code. And `preserve-manual-memoization` —
  informational ("compilation skipped"), and inconsistent: it flags
  `AppShell.tsx:766` while the identical `handlePenEditStart` (`:785`)
  and `handlePenEditCommit` pass.

Fixed in `e88a0d8` (3 files, +43/−27): `DevTestsPane`'s `Row` hoisted to
module scope; the dead `editingAnnotationId: ref.current` return dropped
from `useTextTool` (`:714`, no consumer, and a ref snapshot can never
re-render one); the `import("stamp_tool")` cache-warm in
`useDrawingTools` moved out of the render body into a mount effect.

## Why 32 candidates were declined — file:line as of `e88a0d8`
This is the decision, not a backlog. Every rewrite below is a timing or
visible-output change, and the bar for this pass was *provably*
behaviour-preserving.

**The "latest ref" mirror — 18 sites**, all `ref.current = v` written in
the render body, all commented in place, all read from pointer handlers
or async boot code: `AppShell.tsx:913,915` · `session/useImageSession.ts:141`
· `ImageMetaPanel.tsx:159` · `canvas/ImageGuidesOverlay.tsx:48,52` ·
`canvas/PenOverlay.tsx:129,131,133` · `hooks/useDrawingTools.ts:140,144,146,225,228`
· `hooks/useRedStampTool.ts:56` · `hooks/useStampTeardown.ts:36` ·
`hooks/useTextTool.ts:97,99`. Only two mechanical rewrites exist and
neither is a no-op: `useEffect` can be deferred past a browser task, so a
pointer event landing in that window reads the *previous* value;
`useLayoutEffect` is closer but still differs across an interrupted
concurrent render and adds a per-render callback to `PenOverlay`,
`ImageGuidesOverlay` and `useDrawingTools` — the drag hot path, where
this repo's invariants forbid per-frame cost. Two are hazardous on top of
that: **`useImageSession.ts:141`** is the IndexedDB autosave dirty flag,
read from the flush callback (`:145`) *and* from an effect body (`:165`),
so a rewrite that gets effect ordering wrong silently loses user edits;
**`AppShell.tsx:913/915`** feed the boot sequence's hand-tuned capped
Clerk wait (`while (!authResolvedRef.current && performance.now() < deadline)`,
`:939`) — changing when those refs land changes a race that was tuned by
hand against a slow Clerk.

**Ref read during render, result rendered — 13 sites.**
`hooks/useBrushPreview.ts:29,31(×3),32(×2)` sizes the brush cursor from
`canvasRef.current` / `canvasRectRef.current` during render, and it is
correct *because* the hook calls `setPos()` on every `mousemove`, so a
stale rect never survives a frame. The accident is load-bearing: a proper
fix (ResizeObserver + state) changes how the brush cursor is sized, which
is visual output and cannot be verified headless. `AISettings.tsx:103`
and `TextSettings.tsx:128` gate `disabled=` on `!!stampToolRef.current` —
latent, never observed, and the fix is lifting engine-readiness into
state, i.e. architecture. `ResizeSettings.tsx:222,223,224` are
self-healing: both writers (`:155-157`, `:206-208`) are immediately
followed by a `setState` that forces the re-read.

**`preserve-manual-memoization` — 1 site.** `AppShell.tsx:766`. No
correct rewrite exists — putting `stamp.toolRef.current` in a dep array
compares a value that changes without a render.

## Consequences
+ Two rules go on at zero violations and stay there, and the two things
  the compiler found that were unambiguously wrong (a component declared
  in render, a dynamic `import()` in a render body) cost 20 lines to fix.
+ The 28 flag-only sites are triaged rather than unknown: 11 free (React
  bails out on `Object.is`-identical values), 4 genuinely-correct effect
  usage (`GalleryBar.tsx:100` and `GridThumbnails.tsx:77` object-URL
  lifecycles, `useAIJob.ts:63` Convex query result, `PenOverlay.tsx:176`
  reselect), 2 reset-on-prop-change (`CanvasResize.tsx:42`,
  `ResizeSettings.tsx:153`), 1 that needs attention (below).
- **A named landmine, left armed on purpose:**
  `app/src/components/SubscriptionButton.tsx:172` runs
  `useEffect(() => { if (open) setDraft(general.current); }, [open, general.current])`
  — state written from an effect whose own dep array contains that
  state's source object. It is safe *today* only because `usePreferences()`
  (`app/src/lib/preferences.ts:286-287`) returns `prefs` straight out of
  `useState<Preferences>(loadPreferences)`, so the identity changes only
  on a real commit. Nothing enforces that invariant, and we just decided
  not to gate the rule that would flag it.
- `refs` stays off, so nothing stops a *new* render-phase ref read from
  landing — including the genuinely-buggy shape (a ref snapshot returned
  out of a hook) that fix #2 deleted.
- These 32 declines are only as durable as this file. The probe config
  (`eslint.config.compiler.mjs`) is untracked and wired into nothing, so
  the next person to re-run it sees 32 red lines with no context unless
  they read this ADR first.

## Alternatives rejected
1. **Adopt `recommended-latest` wholesale** — 66 errors, ~46 of them
   needing suppressions on code with no known bug. A gate that opens with
   a wall of `eslint-disable` teaches people to disable, not to fix.
2. **Fix all 38 candidates in this pass** — 18 mirrors and the brush-cursor
   read are timing and visual-output changes that cannot be verified
   headless; CLAUDE.md names exactly that as a bad unattended task.
3. **Take the whole set as `warn`** — 123 more warnings on top of the
   existing 62 makes the stream unreadable, and a warning nobody reads is
   not a gate. Two rules at `error` and zero violations is worth more.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason:
`set-state-in-effect` was written off as noise — 15 of 18 hits genuinely
were — and the one site the rule was right about went unguarded.
`SubscriptionButton.tsx:172` becomes a self-feeding loop (effect →
`setDraft(obj)` → re-render → new `general.current` identity → effect →
…) the instant `usePreferences()` stops returning its `useState` value
verbatim. Someone doing unrelated Convex-sync work adds a `useMemo` with
a sloppy dep or a `{...prefs}` spread, ships it through a green gate
because we declined the only rule that models this, and the Settings
modal hard-locks the General tab for every user.
Early warning sign to watch for: **any diff to `usePreferences()` in
`app/src/lib/preferences.ts` that stops returning the `useState` value
itself** — a spread, a `useMemo`, a merged server object. Treat that diff
as touching `SubscriptionButton` even though it never names it. In the
wild it surfaces as "Maximum update depth exceeded" traced to
`SubscriptionButton` the moment Settings opens.
Cheap insurance if nobody is watching: guard the effect with
`serializePreferences(draft) !== serializePreferences(general.current)`
— that helper is already in scope two lines below at `:175` — or key the
draft off `open` alone.

## Open, needing a human call
1. `CelebrationDialog.tsx:71` `useMemo(fn, [])` → `useState(fn)`: clears 9
   of the 10 `purity` hits and is a prerequisite for turning that rule on.
2. The 18-site mirror migration (`useLatestRef` + `useEffectEvent`), under
   `imagehorse-qc` — or the explicit choice never to adopt `refs`. Doing
   neither and suppressing 31 warnings is the one unacceptable outcome.
3. `useBrushPreview` (6 hits): redesign the brush-cursor sizing, or accept
   and document the mousemove-re-render dependency. Needs a real browser.

Reproducing the pass: `npx eslint app/src --config eslint.config.compiler.mjs`
against `5621471`. That config and the raw violation inventory
(`COMPILER-VIOLATIONS.md`) live untracked on the `chore/react-compiler-rules`
worktree, as did the full session log — this ADR is the part that had to
survive the worktree being deleted.
