# a12 — the transfer. Design, and three things that block the stated plan

**Status:** designed, not built. Written 2026-08-12 after v8.22, opening a12.
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

Give the handle a `blit()` operation instead — local implementation does today's
zero-copy path, worker implementation posts a message — and `flushToCanvas`
becomes:

```ts
const t = toolRef.current;
if (!t) return;
t.recomposite();
void tryTilesFlush(t).then(registerTilesDirtyCount);
void syncOplog(t).then(registerOplogStats);
void onOplogFlush(t);
t.blit();            // <- the only thing that differs, and it differs in ONE place
```

The 5 exempt sites disappear from the gate at that point, which is what
`DISSOLVES_AT_STAGE_4` has always predicted.

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
