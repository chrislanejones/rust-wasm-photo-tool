# PenOverlay async redesign — the last step of ADR-024 Stage 3.5

**Status: ✅ BUILT — shipped v8.19, 2026-08-12.** Written earlier the same day
after v8.17 (a13). The gate went **7 → 5**, its floor, and **Stage 3.5 is
complete**. Kept as the record of why these two sites were hard and what the
implementation actually commits to; the contract test now fails if either site
drifts back OUT of `await`.

**What changed against this design, and why** — three things:

| # | Design said | Built | Why |
|---|---|---|---|
| 1 | guards live in `PenOverlay.tsx` | `penPath.ts` | they needed tests, and this repo has no component-render harness (vitest is `environment: "node"`, `.ts` only) — the a13 `readUiSnapshot` precedent |
| 2 | `hitSeq` bumped inside the hit-test branch | bumped by **every** canvas pointerdown | the design's own words are "a later click superseded us"; a click that takes a different branch supersedes it just as much |
| 3 | — | added a **liveness guard** to both AppShell handlers | not in the design, but a13's `reset()`-mid-flight hole applies verbatim: nothing calls `tool.free()`, so a commit issued against the outgoing photo resolves normally and its id is meaningless to the new one |

⚠️ **One thing this design did not mention and nearly cost the change:**
`CanvasArea`'s `onPenCommit` prop was typed `=> void`, swallowing the id. A
function returning `Promise<number>` **is** assignable to a `=> void` slot, so
tsc would have accepted the conversion while `typeof newId === "number"` quietly
went false. The type was already lying before this change — the id has always
flowed through at runtime. Fixed as part of the work. The lesson generalises:
when tracing what shares a type (the v8.6 question), a `void` return is not
proof that nothing is consumed.

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

### What the v8.19 run actually proved

| Case | Result |
|---|---|
| Click-drag the first anchor | ✅ handles pulled symmetrically, same tick |
| 2 anchors + `Enter` | ✅ 1 `add_bezier_annotation`, 1 undo step, stayed selected |
| Hold `Enter` (12 repeats) | ✅ **1** `add_bezier_annotation` (id 2), not 12 |
| Click an existing path | ✅ re-opened, exactly 2 anchors — **no stray speculative anchor** |
| Switch tool mid-draw | ✅ committed (id 3), undo 16 → 17, `Add Pen Path` |
| Close the loop on anchor 0 | ✅ committed (id 4), filled, **stayed selected** |
| Two fast clicks, two paths | ⚠️ not reachable by hand — see below |
| Switch **photo** mid-draw | ⚠️ not run (one photo in the gallery) |

**The closed-loop case is the load-bearing one.** "Stayed selected" is only
possible if the awaited id came back a real `number`; un-awaited it is a Promise,
`typeof` is `"object"`, and the path silently deselects. That single gesture
proves the return-value contract survived the conversion.

### ⚠️ CASE 6 DOES NOT PROVE THE UNMOUNT RACE IS CLOSED

The single most misreadable green check in this release. "Switch tool mid-draw →
committed, undo 16 → 17" is a **no-regression** result and nothing more.

With `ih_engine_worker` OFF, `attachLivePort` is an identity function: the
`await` inside `handlePenCommit` resolves in a **microtask**, which lands before
React has finished tearing the overlay down. The window the unmount path is
supposed to be dangerous in **does not exist yet**, so a pass here cannot
distinguish "safe" from "never exercised".

Behind the worker it is a real round trip, and the cleanup's commit becomes a
message posted by a component that is already gone. The reasoning that it is
still safe is written down — the request is POSTED synchronously at call time and
the port is FIFO, so the op is queued before teardown proceeds, and nothing
consumes the reply — but that is an **argument from reading `src/ops.rs` and
`port.ts`, not a measurement.** It has never been run against a real worker.

**That test belongs in a12, with the flag ON**, alongside the cross-implementation
matrix. Recording Case 6's pass without this caveat would leave a later reader
believing the unmount path was cleared at Stage 3.5. It was not.

⚠️ **The browser cannot prove either guard, and must not be reported as having
done so.** The port is an identity function today, so `await` resolves in a
microtask and the re-entrancy window never opens — 12 Enter presses produced one
path, but they would have anyway. Likewise two hand-timed clicks always resolve
in order. **The guards are proven by the mutation run** (`M1`–`M4` all killed,
plus a deliberate equivalent mutant that correctly survived); the browser proves
the positive path. Both windows open for real at Stage 4, which is precisely when
there is no gesture evidence left to gather.

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
