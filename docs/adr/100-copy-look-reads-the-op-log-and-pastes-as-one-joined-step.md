# ADR-100: Copy look reads the op log, and Paste look lands as one joined step
Date: 2026-11-02   Status: draft (`feat/copy-paste-look`, night 11-02)   Relates to: ADR-091, ADR-092

## Context

Copy look → Paste to selected gives every ticked photo the open photo's tonal
edits. The panels cannot be the source: Adjustments holds values only while a
session is open, and Presets and Levels keep nothing after Apply. The filters do
not commute, so order matters. AppShell is being dismantled and may not gain
lines, yet it is what holds the live engine.

## Decision

1. **Read.** `oplog_look()` (`src/look.rs`, `tiles` only) walks ops up to the
   cursor, in history order: `Op::TonalStack` (Preset), `Op::Levels`,
   `Op::Adjustments`. An Adjustments session (`new_session` op + later releases)
   is one step with its last values (ADR-091, absolute); a session ending on
   identity is dropped; every other op is skipped. Flat `Vec<f64>`: kind 1 Preset
   ×5, 2 Levels ×3, 3 Adjustments ×7, values in the apply call's argument order.
   Read-only. Op log stays v15. A broken or out-of-scope log answers empty:
   its ops no longer describe the photo, so there is nothing to copy.
2. **Open photo.** `applyLookAsOneStep` (`app/src/lib/look.ts`) sends the steps
   back to back with `continue_step()` between, nothing awaited, so no
   recomposite clears the join (the `usePinSteps.ts` callout pattern), then one
   awaited `undo_count()` read behind them (the worker answers in order). One undo
   step; each call records its usual op.
3. **Other photos** (`features/look/pasteLook.ts`, the `ResizeBatchPanel.tsx`
   rule): stored original at full res in a throwaway `ImageHorseTool`,
   re-encoded over the stored file, no undo; listed as a throwaway engine in
   `engineOwnership.contract.test.ts`. Skipped if it has edits of its own
   (modified mark, `hasPersistedOplog`, or a saved archive), since those would
   restore on the wrong pixels.
4. **Wiring.** `LookHost` mounts inside `SubscriptionButton.tsx`, the one
   component given `openRaster` in both layouts, and registers `copyFromOpen` in
   `useLookStore`. Select ▾, thumbnail right-click and Ctrl+Alt+C / Ctrl+Alt+V
   only call store actions. AppShell untouched.

## Consequences
+ The look survives a photo switch and a reload, and an undone edit is not
  copied. No format change, no Dexie change.
+ The paste on the open photo undoes in one press, after a reload too. A Rust
  test asserts one undo step + byte-exact log replay.
- Copy works only from the open photo. With the top bar hidden (`showTopBar`
  false) the host is unmounted and Copy is a silent no-op.
- Photos that are not open get a lossy re-encode (JPEG/WebP/AVIF) and no undo,
  and any with their own edits are skipped, not pasted.
- A store-held executor is a new indirection: "who answers `copyLook()`" lives
  in a component mounted for an unrelated reason.

## Alternatives rejected
- A JS-side record of each photo's tonal values: wrong after undo or reload.
- Relative paste (add the deltas): ADR-091 sessions are absolute.
- Mounting the host in AppShell: it may not gain lines.
- Restoring a not-open photo's op log in a scratch engine and pasting on top:
  heavier, and a second consumer of the persisted format.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the host
rides on Settings. A layout change that drops or lazy-loads `SubscriptionButton`
in one breakpoint quietly kills Copy and Paste there, and no gate notices,
because the store just holds `null` and `copyLook()` does nothing. Meanwhile the
skip rule makes Paste look broken on exactly the photos people have touched.
Early warning sign to watch for: a "Copy look does nothing" report, or a
`SubscriptionButton` render site that is not passed `openRaster`.
