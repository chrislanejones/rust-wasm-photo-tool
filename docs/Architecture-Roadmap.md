# Architecture Roadmap

> Part of the [Image Horse](../README.md) docs. See also: [Architecture](Architecture.md) · [State Management](State-Management.md) · [File Map](File-Map.md) · [Security Hardening](Security-Hardening.md).
>
> The next evolution isn't "add another tool" — it's tightening the architecture so the app stays fast and maintainable as it grows: a **document-based editor** (React = UI, Zustand = app state, Rust/WASM = image document, Workers = heavy processing, Dexie = persistence, WebGPU = acceleration where available). This maps that target onto the *actual* repo and is honest about how much already exists.

## Where we already are (don't rebuild these)

- **Rust already IS the document engine.** `src/` already owns layers + masks + composite (`layer.rs`), live text/shape annotations (`annotations.rs`), the brush/paint/erase engine (`paint.rs`), effects — blur/pixelate/redact (`effects.rs`), magic-wand selection + marching ants (`selection.rs`), undo/redo history, transforms, and PNG export (`lib.rs`). React does **not** manipulate pixels — it calls the WASM API. So "move the document model into Rust" is largely **done**; the remaining work is trimming the *last* bits of image-adjacent state out of React.
- **SIMD128 is shipped** — `src/simd/{blur,color,resize,pixel}.rs` (real `v128`/`f32x4` kernels with scalar fallbacks). Don't re-add naïve "SIMD" passes.
- **Zustand foundation is underway** (this `zustand-build` branch) — `useUIStore` / `useToolStore` / `useGalleryStore` + the IndexedDB persist adapter. See [State Management](State-Management.md).
- **Dexie content layer landed** (parallel DB) — see [IndexedDB Investigation](IndexedDB-Investigation.md).
- **Web-worker offload is started** — the `feat/wasm-worker-phase1` branch is the in-flight first step toward running heavy ops off the main thread.

## The real weak point

`app/src/app/AppShell.tsx` (~3,245 lines) is the de-facto operating system for the app — dozens of `useState`s + callbacks for uploads, gallery, canvas, tools, history, export, AI, dialogs, zoom, layers, review, compression. **This is where the leverage is.** Everything below orbits shrinking it.

## Prioritized roadmap

| P | Work | Status | Why |
| --- | --- | --- | --- |
| **P0** | **Split AppShell into feature modules** | Foundation laid (stores) | Biggest maintainability win. AppShell → `<AppLayout>` composing `<Gallery/> <Canvas/> <Tools/> <History/> <Dialogs/>`; ~3,000 → ~300 lines. |
| **P0** | **Finish the Zustand migration + atomic selectors** | In progress | `useState` → store selectors store-by-store (UI→tool→gallery), one selector per field = minimal re-renders. See [State Management §7](State-Management.md). Initializers already verified to match store defaults. |
| **P0** | **Workerize heavy ops** (histogram, blur, resize, compression, magic-wand, thumbnails, ZIP, EXIF, decode) | Started (`feat/wasm-worker-phase1`) | Keep the UI responsive during heavy edits: React → Worker → Rust/WASM → transferable buffers → (Offscreen)Canvas. |
| P1 | **Dirty-rectangle rendering** | Not started | Brush a 32×32 region → redraw only that rect, not the whole canvas. Big paint-responsiveness win. |
| P1 | **Command pattern for undo/redo** | Partial (Rust history exists) | Rust already owns the history stack; formalizing per-op Command objects (Rotate/Crop/Brush/Layer…) makes new ops' undo near-free and uniform. |
| P1 | **Dexie project DB redesign** | Module landed | Grow `originals/workingCopies/photos` into `projects / images / layers / undo / exports / thumbnails / caches`, each indexed. See [IndexedDB Investigation](IndexedDB-Investigation.md). |
| P1 | **Virtualize long lists** | Gallery only | History, layers, fonts, brushes, recent colors, AI history — virtualize even at ~20 items for steady memory + smooth scroll. |
| P2 | **GPU / WebGPU pipeline** | Not started | Long-term: levels/curves/LUT/blur/sharpen/perspective as GPU passes where available, CPU/SIMD fallback. |
| P2 | **Rust memory pools** | Not started | Reuse `PixelPool` / `MaskPool` / `HistogramPool` / `SelectionPool` scratch buffers instead of per-op `Vec` allocations. |
| P2 | **Event bus** | Not started | `ImageLoaded` / `BrushFinished` / `HistoryChanged` / `SelectionChanged` events instead of components calling each other directly. Optional once stores + features are clean (stores already decouple a lot). |

## Performance debt (between bugs and features)

Eliminate unnecessary re-renders · replace prop-drilling with store selectors · move CPU-heavy work to workers · reduce allocations · virtualize long lists · cache histogram + thumbnails · batch state updates · lazy-load rarely-used tools · share buffers instead of copying pixels · reuse Rust memory pools · add a perf-profiling overlay (FPS, React renders, Rust/blur/histogram time, worker queue, IDB latency).

## Target tree (aspirational — adapt, don't big-bang)

```
app/src/
├── app/            App.tsx, AppLayout.tsx, providers/, startup/ (boot, preload, migrations)
├── features/       gallery/ canvas/ tools/ layers/ history/ export/ upload/ review/ ai/ preferences/
│                     each owns: components + hooks/ + store/ + selectors/
├── stores/         app/ui/gallery/tool/canvas/layer/history/export/ai + selectors/
├── rust/           wasmBridge, document, commands/, workers/, memory/   (TS side of the WASM API)
├── workers/        histogram / blur / resize / thumbnail / ai .worker.ts
├── persistence/    dexie + repositories/ (images, projects, thumbnails, history, cache)
├── commands/       Rotate, Crop, Brush, Blur, Resize, Layer …
├── events/         EventBus
└── lib/ types/ utils/ components/
```

The Rust modules (`src/layer.rs`, `annotations.rs`, `paint.rs`, …) already match the "document engine" half of this.

## Work buckets (triage — items are *candidates*, verify before fixing)

- **🐛 Bugs** (fix first, but confirm they reproduce): histogram correctness, undo/redo edge cases, layer ordering, crop-handle jumps, brush gaps, clone artifacts, selection-mask issues, compare glitches, rotate/flip, text editing, EXIF orientation, **object-URL leaks**, worker crashes, races, shortcut conflicts, clipboard, export corruption, AI callbacks, IndexedDB recovery.
- **🎨 Layout/UX** (React/Tailwind): sidebar resize, panel spacing, mobile/tablet, dialog sizing, empty/loading states, progress bars, gallery/layer/history panels, keyboard nav, a11y, consistent padding, responsive canvas.
- **🦀 Already in Rust / keep there**: all pixel ops, selection engine, layers, painting, history, geometry, export, memory buffers.
- **🚫 Keep in React**: dialogs, menus, theme, animations, sidebars, panels, preferences, shortcuts, a11y, forms, tooltips, notifications.

**Sequencing:** AppShell split + Zustand selectors first (unblocks everything), then workerization, then dirty-rect rendering — these four are the ⭐⭐⭐⭐⭐ items. Each is independently shippable; avoid a big-bang rewrite.
