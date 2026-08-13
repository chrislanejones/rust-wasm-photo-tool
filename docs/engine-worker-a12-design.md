# a12 — the transfer. Design, and three things that block the stated plan

**Status: ✅ BUILT — a12.0 v8.23, a12.1 v8.24, a12.2 v8.25, gate 3 v8.26.**
Written 2026-08-12 after v8.22, opening a12.
**Prerequisites:** ✅ Stage 3.5 complete (gate 5, all exempt) · ✅ a10 complete
(hot-path 0) · ✅ a11 complete.

ADR-024 describes a12 as *"wire `attachLivePort` to the worker"*, on the basis
that *"today it is an identity function … Stage 3 replaces the body, and no call
site changes."* **That is not implementable as written.** Three separate reasons,
each verified against the code rather than reasoned about.

---

## Trap 1 — the seam is downstream of construction

`attachLivePort(tool)` receives an engine that has **already been built and
loaded with an image on the main thread**. Every one of its five call sites in
`useEngineCore` looks like this:

```ts
const tool = new Tool(img.width, img.height);   // built HERE, main thread
tool.load_image(new Uint8Array(imageData.data));
toolRef.current = attachLivePort(tool);          // …then handed over
```

| Site | Line |
|---|---|
| `loadImage` | `useEngineCore.ts:490` |
| `loadImageFromPixels` | `:544` |
| (paste / AI result) | `:577` |
| `applyRestored` | `:614` |
| `restoreFromSaved` | `:652` |

A worker-backed port cannot accept that handle. Only two options exist and one
is disqualified by this ADR's own invariant:

| Option | Verdict |
|---|---|
| Build the engine on BOTH sides | ❌ two engines, double wasm memory, **two op logs** — the one-port invariant exists to prevent exactly this |
| Move construction into the worker | ✅ the only viable route — but it changes all five call sites |

So the seam has to move up, from *attachment* to *construction*:

```ts
// replaces `new Tool(...)` + `load_image(...)` + `attachLivePort(...)`
toolRef.current = await createLiveEngine({ width, height, pixels });
```

- **local:** `new Tool(w,h)`, `load_image(pixels)`, return it — today's behaviour.
- **worker:** `client.init(w,h)`, `client.call("load_image", [pixels], [pixels.buffer])`,
  return the proxy.

One named factory, one branch, five call sites edited once. `attachLivePort`
keeps its ownership role and `engineOwnership.contract.test.ts` keeps working,
but it stops pretending it is the swap point.

> ⚠️ `BatchSettings.tsx:1051` also does `new ImageHorseTool(...)`. It **must not**
> be routed through this — it is a throwaway engine for a document the user is
> not editing, and the invariant already says so. Leave it building locally.

---

## Trap 2 — a Proxy over the worker defeats every feature detection in the repo

The obvious main-thread handle is a `Proxy` whose `get` returns a function for
any method name, forwarding to `client.call(name, args)`. That breaks four live
guards, because each asks whether a method EXISTS:

| Guard | File | Asks |
|---|---|---|
| `hasPersistExports` | `oplogPersistence.ts` | `typeof t.oplog_encoded_ops === "function"` |
| `hasTilesExports` | `tilesFlush.ts` | `typeof t.tiles_flush === "function"` |
| `hasMagicEraserExports` | `useMagicEraserTool.ts` | `typeof t.magic_eraser_brush_down === "function"` |
| `hasPatchmatchExports` | `patchmatch.ts` | `typeof t.remove_object === "function"` |

A blanket Proxy answers **yes to all of them**, on every build. A default
(non-`patchmatch`, non-`tiles`) wasm would then route `remove_object` to a worker
whose engine has no such method, and the call rejects at runtime instead of the
feature quietly staying off. These guards are load-bearing, not defensive —
`useMagicEraserTool`'s own comment says the tile that reaches it is not itself
flag-gated.

**The fix, and it pays for itself:** the worker enumerates its OWN engine surface
at init and sends it back.

```ts
// in the worker, once, during init
const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(tool));
postMessage({ id: 0, ok: true, value: { surface } });
```

The proxy's `get` returns a forwarding function **only** for names in that set,
and `undefined` otherwise — so `typeof` answers exactly what it answers today.

This is worth more than it looks. It is the same drift that cost v8.19→v8.21: the
audit trusted a hand-synced `.d.ts` and missed 31 methods. A surface reported by
the engine itself cannot drift from the engine.

---

## Trap 3 — the zero-copy blit cannot cross a boundary at all

`flushToCanvas`'s five exempt reads are exempt because they *dissolve*, and this
is what that means concretely:

```ts
const view = new Uint8ClampedArray(wasmMem.buffer as ArrayBuffer, ptr, len);
```

`wasmMem` is **the main thread's** `WebAssembly.Memory`. With the engine in a
worker, that buffer holds nothing — `data_ptr()` / `data_len()` would be indices
into memory this thread does not have. There is no awaiting your way out of it;
the operation is not a read, it is a pointer into another address space.

Falling back to `get_image_data()` is not an answer either: that is a full
composite copy across the boundary **every frame**, which is the regression this
whole arc exists to remove.

So **a12.2 is mandatory, not optional**, and it must land with a12.1 rather than
after it. The canvas transfers, and the blit happens worker-side against the
`OffscreenCanvas`:

| | Local | Worker |
|---|---|---|
| `recomposite` | main thread | worker |
| canvas resize | `canvas.width = w` | worker sets `OffscreenCanvas.width` |
| blit | zero-copy view → backbuffer → `putImageData` | same code, worker-side, against its own memory |
| crossing the boundary | — | **one fire-and-forget message** |

### Containing the branch

`engineAsyncMigration.contract.test.ts` forbids call sites branching on the flag,
for good reason: *"every such branch is a place the two implementations can
diverge."* So `flushToCanvas` must not grow an `if (engineWorkerEnabled())`.

> ⚠️ **RESOLVED 2026-08-12 — `blit()` is a MODULE FUNCTION in `port.ts`, not a
> method on the handle.** The obvious reading of "give the handle a `blit()`" does
> not survive a12.0: the proxy is **surface-gated to real engine methods**, so a
> synthetic `blit` is not reachable through it, and giving the LOCAL path one
> would mean wrapping the raw engine — which costs the identity property a13's
> liveness guard (`toolRef.current === t`) depends on, and which
> `createLiveEngine.test.ts` now pins.
>
> The contract test's own allowlist supplies the answer: `lib/engine/port.ts`
> *"owns the flag — this is where the local/worker choice belongs."* So a
> `blitLiveEngine(tool, canvas)` exported from `port.ts` branches internally, and
> `flushToCanvas` calls it with no branch of its own. Same containment, no
> wrapper, no proxy on the local path.

Give the port a `blit` operation instead — local implementation does today's
zero-copy path, worker implementation posts a message — and `flushToCanvas`
becomes:

```ts
const t = toolRef.current;
if (!t) return;
t.recomposite();
void tryTilesFlush(t).then(registerTilesDirtyCount);
void syncOplog(t).then(registerOplogStats);
void onOplogFlush(t);
blitLiveEngine(t, canvas);   // <- from port.ts; the ONLY thing that differs,
                             //    and it differs inside port.ts, not here
```

The 5 exempt sites disappear from the gate at that point, which is what
`DISSOLVES_AT_STAGE_4` has always predicted.

### Two concrete prerequisites, checked 2026-08-12

**The worker does not capture its wasm memory yet.** `engine.worker.ts:165` does
`await mod.default()` and discards the result. The main thread keeps
`wasmMemoryRef` precisely because the zero-copy blit needs
`memory.buffer` — the worker will need the same handle for the same reason, so
the init path has to keep it. Without it the worker-side blit falls back to
`get_image_data()`, i.e. a full composite copy per frame, which is the
regression this step exists to avoid.

**`registerWasmMemory(...)` is main-thread only.** With the flag on, the main
thread still loads the wasm module (all five load paths call `init()` for the
`Tool` constructor and the memory handle) even though it will never build an
engine. That is wasted module memory, not a correctness problem, and it is
a12.2 cleanup rather than a12.1's — the `Tool` constructor is still needed by
the local branch, and the local branch is still the default.

---

## What to build, in order

| Step | Content | Can it be verified? |
|---|---|---|
| **a12.0** | `createLiveEngine` factory + the worker's `surface` reply + the surface-gated proxy | yes — fake worker, unit tests |
| **a12.1** | route construction through it behind the flag; local path byte-identical | yes — the whole suite, flag off |
| **a12.2** | `OffscreenCanvas` transfer + `blit()` on both implementations | only with the flag ON |
| **a12.3** | the three acceptance gates | only with the flag ON |

a12.0 and a12.1 are safely buildable now and testable with the flag off. **a12.2
is where the flag has to be turned on for the first time**, and nothing before it
proves anything about the worker path.

## The acceptance gates (unchanged from the plan, restated with what is now known)

1. **Tool switches under the flag.** The stale-generation rejection must be
   OBSERVED firing at least once — a rejection path that never runs is
   indistinguishable from one that does not work.
2. **Cross-implementation matrix.** Equivalence, not smoke: compare output bytes
   or checksums flag-OFF vs flag-ON. Include the PenOverlay unmount race, which
   only becomes real here (v8.19 recorded that its green check does not cover
   this).
3. **Op-log equivalence — the one that can say no.** `oplog_encoded_ops(0, n)`
   returns the log as bytes, so this is a direct byte comparison for the same
   operation sequence under both implementations. The one-port argument
   (`OpLog::append` records arrival order, no `Op` carries a sequence number, a
   `MessagePort` is FIFO) has only ever been argued from reading `src/ops.rs`. If
   the bytes differ, a12 stops until it is understood.

⚠️ Give gate 3 a sequence long enough and interleaved enough to expose an
ordering difference. A short linear sequence would pass under almost any
implementation and prove nothing.

## a12.3 gate 3 — RUN, AND IT PASSED (2026-08-12, v8.26)

**The central assumption of the whole arc now has evidence behind it.**
`OpLog::append` records arrival order, no `Op` carries a sequence number, and a
`MessagePort` is FIFO — so postMessage order *is* append order. That had only
ever been argued from reading `src/ops.rs`. It has now been run against a real
worker.

### Why the first attempt measured nothing

v8.25 reported gate 3 as NOT RUN because the log stayed at `opCount: 0` through
annotations, rotations and adjustments. The reason is one line in `lib.rs`:

> `oplog_sync_annotations` — *"Diff the engine's annotation lists against the
> log's and record the difference as ops. **Runs at every `recomposite()`**"*

The probe never recomposited, so nothing was ever recorded. Adding
`recomposite()` after each mutation turns the log from `armed — base captured,
no ops yet` into `recording`. The recorded set is `Stroke`, `FillRegion`,
`Blur`, `Levels`, `Crop`, `Text*` and `Shape*` — **not** `rotate_90_cw` or the
`adjust_*` family, which is why those produced nothing.

### The instrument was checked before the result was believed

| Check | Result |
|---|---|
| Same 8 adds in FORWARD order | `c4df040e…` |
| Same 8 adds in REVERSE order | `5be868f9…` |
| **Order-sensitive?** | ✅ **yes** — a reordering changes the bytes |

Without this the equality would have been worthless: a fingerprint that cannot
tell two orderings apart cannot certify that ordering was preserved.

### The sequential pass — necessary, not sufficient

15 interleaved steps (adds, an edit, a remove, undos, redos), each awaited:

| | LOCAL | WORKER |
|---|---|---|
| ops | 9 | 9 |
| bytes | 1047 | 1047 |
| oplog SHA-256 | `c4df040e…` | `c4df040e…` |
| composite | `a9e9b732e2e9a0ee` | same |

⚠️ **This proves less than it looks.** Awaiting each call makes postMessage
order trivially equal to call order. It tests the plumbing, not the queue.

### The concurrent burst — this is the actual gate

**16 mutations issued with NO await between them**, so all 16 messages are in
flight simultaneously, then a second burst of 6 edits against ids from the
first:

| | LOCAL | WORKER |
|---|---|---|
| ids returned | `1..16` in order | **`1..16` in order** |
| ops | 7 | 7 |
| bytes | 910 | 910 |
| **oplog SHA-256** | `ea77112d…` | **`ea77112d…`** |
| first 32 bytes | identical | identical |
| composite | `f3ee448a03b34669` | same |

The worker's queue drained 16 concurrent requests in post order and produced a
**byte-identical** log. That is the claim, tested the way it can fail.

### Verdict

**PASS.** a12.3's three gates now stand at: 1 partial, 2 pass, 3 **pass**.
Stage 5 is no longer blocked on gate 3 — it is blocked on gate 1's remount case
and on the measurement.

## Notes carried in

- **Warm the worker before the flip hands it work** — 715.4 ms cold vs 392.1 ms
  warm (a11.0). The most likely thing to be skipped, and skipping it makes the
  first action after a flip *worse* than before the migration.
- **Terminate the losing instance on a flip** — wasm memory never shrinks; a
  leaked instance raises the tab's floor permanently (~75 MB in the flip window).
- **The 22 ms flush is not free.** In-worker 22.1 ms vs 23.9 ms main.
- **Round trip is 0.100 ms median / 0.300 ms p95** — 0.6% of a frame. Latency is
  not the obstacle and never was.
- **`syncOplog` is 9 reads per flush** for a diagnostics panel (PARKING_LOT.md).
  Behind the worker that is ~0.9 ms/frame of pure overhead. Decide it before
  Stage 5's measurement, or it will be misread as the architecture's cost.

## a12.3 gate 1 — RUN, AND IT PASSED (2026-08-13, v8.28)

**The gate needed a foregrounded window and finally got one.** v8.27 recorded
three blocked routes and the reason: a backgrounded tab gets zero rAF callbacks,
so the tool rail parks off-screen and clicks miss. The instrument that worked is
a Playwright-driven page, which is visible by construction — `document.hidden`
was `false` on the first check, against `true` in the Chrome extension's tab.

### Gate 1 is two requirements, and the second is the one that gets skipped

| requirement | result |
|---|---|
| the canvas never blanks | **PASS** — 8 Batch crossings, generations `1,0,2,0,3,0,4,0,5,0,6,0,7,0,8` |
| the rejection is OBSERVED firing | **PASS** — forced, logged, and controlled |

The generation sequence is the whole handshake, visible: every mount transfers a
fresh element, every unmount releases with `NO_CANVAS`, and blits keep flowing
throughout (23 → 36 across the crossings).

**The rejection does not fire in ordinary use, and that is structural rather
than lucky.** The unmount path sets `surface = null`, and `blit()` returns at
`if (!tool || !surface)` — above the staleness check. So the check can only fire
when the worker still HOLDS a surface whose generation has been superseded,
which the ordinary lifecycle never produces. It was forced exactly as the plan
required, by posting a `canvas` message with a generation the surface does not
carry:

```
[engine-worker] blit refused: stale canvas: work targets generation 1, live generation is 999
```

And then controlled, because a refusal is indistinguishable from a dead draw
path unless you show the same call working:

| | pixels changed |
|---|---|
| document rotated 90°, blit sent, generation **stale** | **0** |
| same blit, generation **restored** | **1,135,280** |

### The PenOverlay unmount race — also PASS

v8.19 recorded that its green check did not cover this: with the flag off
`finish()`'s await is a microtask that resolves before React tears down, so the
dangerous window does not exist. Behind the worker it is a round trip. Three pen
anchors, then a tool switch with the path still open: **undo 0 → 1**, committed
exactly once, no errors. The re-entrancy guard holds.

### What the gate found that the gate was not looking for

Two defects, both fixed in v8.28, both invisible to the entire test suite:

1. **Every load past the first left a blank canvas.** The worker holding the
   `OffscreenCanvas` was disposed and rebuilt per document; an element yields a
   surface exactly once. A green test asserted this behaviour.
2. **Capture structs arrived as `{ __wbg_ptr }`.** See ADR-024, "The fifth trap
   shape".

Neither is a remount problem. Both sat upstream of the gate, on the path
ordinary use takes every time — which is the argument for running a gate on the
real thing rather than reasoning about the part you meant to test.

### Verdict

**PASS.** a12.3's three gates stand at 1 **pass**, 2 pass, 3 pass. a13 is
measured (ADR-024, Stage 5). a14 — the default flip — is deliberately NOT taken
in the same session; the reasoning is in ADR-024.
