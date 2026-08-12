# PenOverlay async redesign — the last step of ADR-024 Stage 3.5

**Status:** designed, not built. Written 2026-08-12 after v8.17 (a13).
**Blocks:** Stage 4. The Stage 3.5 gate sits at **7** and cannot go lower
without this — see `engineAsyncMigration.contract.test.ts`, which fails if
either site is converted with a plain `await`.

---

## Why this is not a conversion batch

Every other Stage 3.5 site was "put `await` in front of it and check the guard".
These two are not, and a session that treats them that way ships a pen tool that
silently drops strokes.

| Site | Call | Why an `await` alone breaks it |
|---|---|---|
| `AppShell.tsx` `handlePenCommit` | `add_bezier_annotation` | Its **return value is the contract.** `PenOverlay.finish()` uses the new id to keep the finished path selected. Un-awaited, `newId` is a Promise. |
| `AppShell.tsx` `handlePenHitTest` | `capture_pen_hit` | Consumed **synchronously inside pointerdown** to fork between "re-open the path under the cursor" and "start a new one". There is no pending state for that fork to live in. |

One accident works in our favour and must not be mistaken for the fix:
`finish()` guards the id with **`typeof newId === "number"`**, and `typeof` a
Promise is `"object"`. So an un-awaited conversion *degrades* to "the path you
just drew is not kept selected" rather than corrupting anything. That is a
regression, not a safe outcome — but it means there is no data-loss cliff if
someone does it by mistake.

---

## The call graph, as it actually is

`onCommit` (→ `handlePenCommit`) has **two** callers, and they are not alike:

| Caller | Location | Uses the id? | Can await? |
|---|---|---|---|
| `finish()` | `PenOverlay.tsx:189` | **yes** — sets `stayOn` | yes, if `finish` goes async |
| unmount cleanup | `PenOverlay.tsx:227` | **no** — discarded | **no** — a React cleanup cannot await |

`finish()` in turn has five callers, and — checked, not assumed — **all five can
await**, because every one of them is either an event listener or a React
handler, none of which needs a synchronous return:

| # | Trigger | Line |
|---|---|---|
| 1 | `Enter` — close and keep selected | 294 |
| 2 | `Escape` — commit and deselect | 307 |
| 3 | pointerdown outside the canvas | 377 |
| 4 | pointerdown on the first anchor's handle (the close gesture that actually fires) | 493 |
| 5 | pointerdown near the first anchor in `onCanvasDown` | 426 |

`onHitTest` (→ `handlePenHitTest`) has exactly **one** caller: `onCanvasDown`,
line 433, guarded by `anchors.length === 0` — so it only runs on the **first
click of a gesture**. That narrowness is what makes this tractable.

---

## The design

### 1. The unmount cleanup is already fire-and-forget — leave it that way

The cleanup discards the id. So `void cb.onCommit(...)` is correct, and the FIFO
argument from a13 applies unchanged: the message is **posted synchronously** at
call time even though the reply is async, so the op is queued before anything
`reset()` does to the port. Same ordering as today.

> ⚠️ This is the one place where the reasoning must be written down in the diff.
> "A cleanup cannot await" reads like a blocker; it is not, *because nothing here
> consumes the result.* The blocker is `finish()`, which does.

### 2. `finish()` goes async, with a re-entrancy guard

```
const finishingRef = useRef(false);
const finish = useCallback(async (mode, keepSelection = false) => {
  if (finishingRef.current) return;      // <- the new failure mode
  finishingRef.current = true;
  try { ...existing body, with `const newId = await onCommit(...)`... }
  finally { finishingRef.current = false; }
}, [...]);
```

**The guard is the whole risk of this step.** Today `finish()` is synchronous, so
it cannot overlap itself. Async, it can: hold `Enter`, or press `Enter` while a
pointerdown-outside is in flight, and the same `anchorsRef.current` gets
committed twice — **two identical paths, one undo step each.**

`typeof newId === "number"` stays as-is. It is correct for an awaited number and
it is the accidental safety net described above; deleting it buys nothing.

### 3. `onCanvasDown` — speculate, then correct

The naive fix is to `await` the hit test before deciding, and it costs the thing
that makes the pen feel like a pen: **click-drag on the first anchor pulls its
handles.** `dragRef.current` has to be set in the same tick as the pointerdown or
the drag is already underway before the tool knows it started.

So do not await before acting. Act, then correct:

```
const hitSeq = useRef(0);
// ...inside onCanvasDown, the `anchors.length === 0 && onHitTest` branch:
const seq = ++hitSeq.current;
dragRef.current = { kind: "create", index: 0 };     // speculative — feels instant
setAnchors([{ x: ix, y: iy, in: null, out: null }]);
const hit = await onHitTest(ix, iy);
if (seq !== hitSeq.current) return;                 // a later click superseded us
if (hit) {
  const { anchors: a, closed: cl } = deserialize(hit.points);
  if (a.length >= 2) {
    dragRef.current = null;                         // abandon the speculative anchor
    onEditStart?.(hit.id);
    setEditingId(hit.id); setClosed(cl); setAnchors(a);
  }
}
```

Why this is safe rather than clever:

| Concern | Answer |
|---|---|
| The speculative anchor is a real edit | **No.** Anchors are local React state until `finish()` commits. Discarding one costs nothing and touches no engine op or undo step. |
| A stale drag index after the swap | Already handled — the pointermove handler's `setAnchors` opens with `if (d.index >= a.length) return a;` (line 255), and we null `dragRef` anyway. |
| Two fast clicks interleaving | The `hitSeq` check. Without it, click 2's hit test can resolve before click 1's and load the wrong path. |
| A visible flicker | One frame with a single anchor dot before the path loads. Zero-cost today (the port is an identity function); one round trip at Stage 4. |

---

## What must be tested, and how

`tsc`, eslint and the ratchet **cannot see any of this** — the ratchet counts
engine calls, and every failure mode here is a state-machine ordering bug. This
needs real gestures.

| Case | Expected | Catches |
|---|---|---|
| Click-drag the first anchor of a new path | handles pull smoothly, no dropped frames | the naive `await`-first version |
| Draw ≥2 anchors, press `Enter` | one path committed, **one** undo step, stays selected | the re-entrancy guard |
| Hold `Enter` down | still **one** path | the re-entrancy guard |
| Click an existing path while idle | it re-opens, no stray anchor left behind | the speculative-anchor cleanup |
| Two fast clicks on two different paths | the **second** one opens | the `hitSeq` guard |
| Draw a path, switch tool mid-draw | path is committed, not lost | the unmount cleanup |
| Draw a path, switch **photo** mid-draw | commits to the outgoing photo (today's behaviour), new photo unaffected | FIFO + a13's liveness guard |
| Click first anchor to close a loop | fills, stays selected | caller #4, the one that actually fires |

**Mutation targets** (each must be killed by a test above): drop the
`finishingRef` guard; drop the `hitSeq` check; `await` before setting
`dragRef.current`; leave the speculative anchor in place on a hit.

> ⚠️ Do not verify this in a backgrounded tab. `document.hidden` throttles
> timers and rAF — it cost two 45 s CDP timeouts and one misread screenshot
> during v8.17. Drag gestures need a foreground window.

---

## Scope note

This is a **UI state-machine change to a drawing tool**, which the project's own
rules put on the do-not-do-overnight list: it changes visual output and cannot be
verified headless. Give it a session with a foreground browser.

When it lands, the gate reaches **5** — the `DISSOLVES_AT_STAGE_4` floor — and
Stage 3.5 is complete. The three inherited constraints for a12 are recorded in
ADR-024: warm the worker before the flip, terminate the losing instance (wasm
memory never shrinks), and the 22 ms flush is not free.
