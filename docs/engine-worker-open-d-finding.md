# OPEN-D — the op log and undo ordering under async

**Answer: the op log is safe by construction. The risk is 9 read-modify-write
sequences, not 119 reads.** Measured 2026-08-07 against v7.73 (`8e18278`).

ADR-024 called this "the largest remaining unknown" and left it untouched by
instruction. It is smaller than it looked, and it points at an option.

---

## 1. Ordering cannot break — two structural facts

**`OpLog::append` records arrival order** (`src/ops.rs:1004`). It applies the op
to `live` and pushes it in one step. There is no caller-supplied sequence
number and no timestamp anywhere in `Op` — the log's order *is* the order calls
reach the engine.

**Each op is atomic** (`apply`, `src/ops.rs:651`): a synchronous `match` that
mutates the document and returns. Nothing interleaves inside an op.

A `Worker` message port is FIFO. So if every mutation goes through **one** port,
`postMessage` order equals append order, and the log is byte-identical to what
it records today. The pre-mortem's fear — *"operations that used to complete
between two paint frames now interleave, and the op log recorded them in an
order the undo stack could not reproduce"* — does not apply to a single-port
design.

**The condition is load-bearing.** Two ports, or any path that reaches the
engine outside the queue, and this guarantee is gone. That is the invariant to
write down, not a thing to verify later.

## 2. The real risk: read → decide → write

Today a read is synchronous, so nothing can change between reading engine state
and acting on it. Behind a worker the value arrives on a **later task**, and any
mutation queued in between lands first. The decision is then made on state that
no longer exists.

`scripts/engine-rmw-audit.mjs` counts these. Two shapes:

| Shape | Meaning |
|---|---|
| **GUARD** | a read gates a later mutation — `if (t.text_annotation_count() > 0) t.flatten_text_annotations()` |
| **FEED** | a read's value becomes an argument — `const cx = t.width()/2; … t.blur_region(cx, …)` |

### Result: 9 sequences

| File | n | Sites |
|---|---:|---|
| `hooks/useEngineCore.ts` | 2 | `width`/`height` → `recomposite` |
| `hooks/useTransforms.ts` | 2 | `width`/`height` → `blur_region` |
| `lib/openraster/export.ts` | 2 | annotation counts → `flatten_text_annotations` |
| `app/AppShell.tsx` | 1 | `align_annotation` → `set_editing_shape` |
| `app/session/useCanvasActions.ts` | 1 | `text_annotation_count` → `flatten_text_annotations` |
| `lib/exportImage.ts` | 1 | `text_annotation_count` → `flatten_text_annotations` |

**How the number was reached, because the first run was wrong.** The raw scan
said **31**. Hand-checking found the block detector was lumping sibling
callbacks together — `useSelectionActions:115` and `:263` are different
callbacks. Adding a handle-redeclaration boundary gave **13**. Hand-checking
again found `useHistory`'s `undo` (:27) and `clearHistory` (:67) are separate
`useCallback`s that both reach the engine as `toolRef.current?.`, so no handle
is redeclared between them; adding a callback-boundary check gave **9**. Every
one of the 9 was then read by hand.

31 → 13 → 9, each step driven by a false positive found by eye. Quote 9, and
re-run the script rather than trusting this table after the code moves.

## 3. The one that matters is in the flush path

```
useEngineCore.flushToCanvas()
  const w = t.width();
  const h = t.height();
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; ... }
  t.recomposite();                     // ← blit follows
```

The canvas is sized from a read, then the composite is rebuilt and blitted. If
a resize lands between the read and the recomposite, the canvas is sized for
the old dimensions while the pixels are the new ones — a torn or misaligned
frame, per-frame, in the hot path.

**This is an argument for Option A that ADR-024 did not have.** Under Option A
(engine *and* canvas in the worker) this sequence stops crossing the boundary
at all: `width`, `height`, the canvas resize and `recomposite` all happen
worker-side, in one task, with no await between them. The worst site dissolves
rather than being rewritten.

Under Option B (canvas stays on the main thread) it is the site that needs the
most care — the flush must carry its dimensions **in the message** rather than
reading them separately, so the size and the pixels can never disagree.

## 4. What this does to the option choice

| | Option A — engine + canvas in worker | Option B — canvas stays |
|---|---|---|
| Ordering | safe (one port) | safe (one port) |
| Worst RMW site | **dissolves** | must be restructured |
| Remaining RMW work | 8 sites | 9 sites |
| Still open | **OPEN-B** — zoom/pan under transfer | none of this |

OPEN-D does not kill any option. It removes the reason to fear all three, and
it tilts toward A — which puts the whole weight of the decision back on
**OPEN-B**, the one remaining unknown: whether zoom/pan survives
`transferControlToOffscreen`, given the element is CSS-sized while its backing
store stays at image resolution.

## 5. What is still not answered

- **OPEN-B.** Unchanged and now the only blocker. Measurable with the existing
  spike page.
- **Reachability.** The scan proves these 9 sequences *exist*; it does not prove
  an interleaving is reachable at each. A site whose mutations can only be
  triggered by the same gesture is safe in practice.
- **The persisted archive.** Untouched here, as in Phase 0. Op-log persistence
  (`oplogPersistence.ts`) writes chunks + keyframes on a debounce; whether a
  debounced write can straddle an async boundary mid-flush is its own question.
