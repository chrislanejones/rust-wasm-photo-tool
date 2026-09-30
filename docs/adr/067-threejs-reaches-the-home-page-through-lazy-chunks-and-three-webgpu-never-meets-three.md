# ADR-067: three.js 0.170 reaches the home page through lazy `*.three.ts` chunks, and `three/webgpu` never shares a scene with `three`
Date: 2026-09-24   Status: accepted (ships in v8.96)

## Context

ADR-057 (2026-09-17) pinned `three` 0.165.0, marketing-only, behind ONE
re-export module (`posts/engine-in-a-worker.three.ts`), and said "Nothing else
may import `three`". That had drifted before this release: #219 (`c1ac5d65`,
09-22, first tagged v8.87) added `posts/offline-by-construction.three.ts`, a
second re-export module. v8.96 ports the design's home-page bottom section,
whose WEBGPU cube word and trotting horse are written against
`WebGPURenderer` from `three/webgpu`. 0.165 has no such entry. It first
appears in 0.167.0 (npm registry `exports`: absent in 0.165/0.166, present in
0.167 onward).

## Decision

| Choice | What |
|---|---|
| Version | `three` and `@types/three` **0.170.0**, still pinned exact (`marketing/package.json:22,28`). 0.170 is the version picked for the port, not the lowest one that works. |
| The rule that holds now | Every **runtime** import of `three` or `three/webgpu` lives in a `*.three.ts` module, and that module is only ever reached through a dynamic `import()`. `import type` is exempt, because it is erased (`posts/*.scenes.ts:18/20`). There are four such modules today: two blog posts and two home-page modules. |
| Home chunks | `components/gpu-letters.three.ts`: 103 instanced lit cubes. It replaces the hand-written WGSL + Canvas 2D that `CubeLetters.tsx` carried at HEAD. `components/horse-trot.three.ts`: `public/horse.glb` (181,792 B, one mesh, 15 morph targets). |
| Load | `CubeLetters.tsx:51-66` uses an `IntersectionObserver` at `rootMargin: "300px 0px"`. `HorseTrot.tsx:14-52` checks `matchMedia("(min-width: 64rem) and (hover: hover) and (pointer: fine)")` before anything is requested, then uses an observer at `"200px 0px"`. The horse is on Home only (`Home.tsx:412` `<Footer … horse />`). |
| One core per scene | The home chunks import from `three/webgpu` only (`gpu-letters.three.ts:32`, `horse-trot.three.ts:31`). The GLB is parsed by hand, with no GLTFLoader, because "GLTFLoader imports from `three` … Mixing the two breaks the renderer's `instanceof` checks" (`horse-trot.three.ts:7-11`). In the build, `three.webgpu-*.js` imports nothing from `three.module-*.js`. |
| Honest backend | `WebGPURenderer` falls back to WebGL 2. The label reports what `r.backend.isWebGPUBackend` says, and says "none" if `init()` throws (`gpu-letters.three.ts:270-292`, `CubeLetters.tsx:30-34`). |

Measured on the existing `marketing/dist` (raw / `gzip -9`):

| Chunk | Raw | Gzip -9 |
|---|---|---|
| `three.webgpu-*.js` (shared by both home chunks) | 574,634 | **155,305** |
| `three.module-*.js` (shared by both posts) | 481,826 | 118,540 |
| `gpu-letters.three-*.js` | 4,253 | 2,210 |
| `horse-trot.three-*.js` | 3,241 | 1,830 |
| `engine-in-a-worker.three-*.js` | 529 | 344 |
| `offline-by-construction.three-*.js` | 503 | 341 |
| entry `index-*.js`, for scale | 304,211 | 97,212 |

**0 of the 24 prerendered HTML files** reference any of these chunks. `Home-*.js`
and `Footer-*.js` name them only in `__vite__mapDeps`, the preload list for the
dynamic import. Both blog scenes were checked on 0.170 in this release's
session: they render, with no console errors, and the WebGL 2 path draws.

## Consequences

+ The design's lit, tilting 3D cubes and the horse ship as drawn, and none of their weight is on the home page's first load.
+ The cube label cannot claim a GPU path the machine did not provide.
- **155 KB gzipped of `three/webgpu` now sits on the home page**, lazily. It is the largest JS asset the site serves, larger than the entry bundle, and every reader who scrolls to the cubes pays for it. A desktop reader also downloads 178 KB of GLB.
- **The WebGPU path is unverified on real hardware.** In headless Chromium it drew blank white canvases, but a bare three.js WebGPU control drew blank too. So this is not a bug found, and not a pass either. A check in a real browser on a real GPU is still OWED.
- There are two copies of three's core (classic + WebGPU). A reader who sees both a blog figure and the cubes downloads both.
- No gate enforces the chunk rule, just as none enforced ADR-057's.
- The dynamic import in `CubeLetters.tsx` has no `.catch`, so if the chunk fails to load, the label stays on "Starting…".

## Alternatives rejected

1. **Keep 0.165 and hand-port the WebGPU renderer.** That means maintaining a renderer we did not write, to avoid a version bump.
2. **Keep the hand-written WGSL cubes.** The design asks for lit 3D cubes that tilt toward the pointer, and building that means building a renderer.
3. **GLTFLoader for the horse.** It imports classic `three`, and that breaks `instanceof` inside a `three/webgpu` scene.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: someone
adds a static `import { … } from "three/webgpu"` (or `"three"`) to a page
component "just for a `Color`". The build succeeds, and Home now preloads
155 KB on first paint, which is exactly what this ADR exists to prevent.
The second most likely reason is that the unverified WebGPU path renders
wrong on some real GPU, and the label honestly reports "WebGPU" over a broken
picture. **Early warning sign:**
`grep -lE 'three\.(webgpu|module)-|\.three-' $(find marketing/dist -name '*.html')`
prints anything (it prints nothing today), or entry `index-*.js` jumps by six
figures. Note that a bare `grep three index.html` is vacuous: the home page
prose already says "three" in plain English.
