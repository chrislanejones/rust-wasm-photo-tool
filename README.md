# clone stamp tool - more tools coming soon

A Photoshop-style clone stamp tool running entirely in the browser, powered by
a Rust/WebAssembly engine and a React frontend.

![screenshot placeholder](docs/screenshot.png)

## what it does

Paint pixels from one part of an image onto another. Hold **Alt** and click to
set a source point, then paint over the area you want to replace. Useful for
removing objects, patching textures, or just making a mess.

## features

- **Rust/WASM engine** — all pixel blending runs in WebAssembly for near-native
  performance
- **Stroke interpolation** — dabs are spaced along the stroke path so fast
  brushstrokes never leave gaps
- **Hardness falloff** — quadratic edge feathering for smooth or hard-edged
  brushes
- **Opacity control** — per-dab alpha blending
- **Zoom** — Alt+Scroll to zoom 0.1× to 10×
- **Undo/redo** — full stroke-level history (up to 50 entries)
- **History panel** — jump to any point, delete individual entries, or clear all
- **Export** — download the result as a PNG

## controls

| Action | Input |
|---|---|
| Set source point | Alt + Click |
| Paint | Click + Drag |
| Undo | Ctrl+Z / Cmd+Z |
| Redo | Ctrl+Shift+Z / Cmd+Shift+Z |
| Zoom in/out | Alt + Scroll |

## project structure

```text
├── src/              # Rust WASM engine
│   └── lib.rs
├── pkg/              # wasm-pack output (git-ignored)
├── app/              # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── CanvasArea.tsx
│   │   │   ├── HistoryPanel.tsx
│   │   │   └── Toolbar.tsx
│   │   └── hooks/
│   │       ├── useBrushPreview.ts
│   │       └── useCloneStamp.ts
│   └── index.html
└── Cargo.toml
```

## getting started

### prerequisites

- [Rust](https://rustup.rs)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/)
- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io)

### dev

```bash
# build the WASM package
wasm-pack build --target web --out-dir pkg

# install deps and start the dev server
cd app
pnpm install
pnpm dev
```

### production build

```bash
# from the repo root
pnpm run build:all
```

Output goes to `www-dist/`.

## how the engine works

Each mousedown→mouseup gesture is one **stroke**. At the start of a stroke the
offset between the source point and the destination is locked in. As the mouse
moves, `continue_stroke` interpolates dab positions along the path at intervals
of `brush_size × spacing`, calling `apply_dab` at each point.

`apply_dab` iterates every pixel within the brush radius, computes a falloff
weight based on distance and hardness, then blends source pixels into
destination pixels using that weight multiplied by opacity.

Before the first dab of a stroke lands, a snapshot of the full image buffer is
pushed onto the undo stack. Undo/redo swap the current buffer with snapshots on
the respective stacks.

## deployment

The repo includes a `netlify.toml` that builds and deploys automatically:

```toml
[build]
command = "wasm-pack build && cd app && npm ci && npm run build"
publish = "www-dist"
```

Just connect the repo to a Netlify project and push.