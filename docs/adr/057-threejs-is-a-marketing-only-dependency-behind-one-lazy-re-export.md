# ADR-057: three.js is a marketing-only dependency, bundled and reached through one lazy re-export module
Date: 2026-09-17   Status: draft

> **Numbering.** 056 is the highest ADR on master, and **057 is free on every
> ref** — checked against master, all 24 local branches, both remotes and both
> worktrees, plus a grep for `ADR-057/058/059` across tracked files. The
> evening plan pencilled 057 for fonts and 058 for sync; neither file exists
> anywhere yet, and a plan does not hold a number. The fonts ADR that *does*
> exist, on the still-open `feat/runtime-fonts` (PR #131), is numbered **053**
> — which master has since spent on the shape-perspective ADR, so that one
> needs a new number whenever it lands, and it is not this one. (043 remains a
> permanent gap, as ADR-055 records.)

## Context

The blog post "The engine left the main thread" shipped with static figures.
Commit `abadd514` makes five of them move, and **three are WebGL scenes** —
FIG 1 (where things live), FIG 2 (three doors and the wall), FIG 4 (the
transfer, in four beats). FIG 3 is a log-scale bar table and FIG 5 a DOM
timeline; neither needs a 3D library. The scenes came from Chris's design export
as **imperative three.js**, and the marketing site had no 3D dependency at
all.

The export loaded three from unpkg at runtime. The marketing site cannot:
`marketing/vercel.json` sets `script-src 'self' https://www.googletagmanager.com`,
which admits no CDN. So the choice was bundle it, rewrite the scenes for
something smaller, or drop the figures.

## Decision

`three` **0.165.0** in `marketing/package.json` dependencies, `@types/three`
**0.165.0** in devDependencies. Both **pinned exact**, where every other
marketing dependency carries a caret.

| Choice | What | Why |
|---|---|---|
| Scope | `marketing/` only. Neither the root nor `app/` carries it; `pnpm-lock.yaml` lists it under the `marketing:` importer alone | it is a blog post's decoration, not app surface |
| Chunk boundary | `marketing/src/posts/engine-in-a-worker.three.ts` — static re-exports of the **nineteen** classes the scenes use. **Nothing else may import `"three"`** | static re-exports let Rollup drop the rest (three's main build is marked side-effect free); a bare `import("three")` hands over the whole namespace with no way to know what was used |
| Load | dynamic `import()` in `figures.tsx`, fired by an `IntersectionObserver` at `rootMargin: "25%"`, fetched in one `Promise.all` with the scenes chunk | the cost is paid by a reader who scrolls to a figure, and by nobody else |
| Failure | the `catch` sets status `failed`; the framed box, the aspect ratio and the figcaption stay | the figure degrades to what the server already prerendered |
| Prerender | the render path touches no `window`, `matchMedia` or WebGL; everything browser-shaped happens in an effect | `scripts/prerender.mjs` runs this under Node |

Measured on the production build:

| | Raw | Gzipped |
|---|---|---|
| `engine-in-a-worker.three-*.js` | 473,970 B | **116,614 B** (gzip -9; 117,056 at -6) |
| three 0.165.0 ESM build, untree-shaken | 1,284,652 B | — |
| `engine-in-a-worker.scenes-*.js` | 14,071 B | — |

**Blast radius, verified in `dist/`:** exactly one file references the chunk
(`assets/index-*.js`, the lazy import), **no prerendered HTML references it**,
and no page preloads it. Home, blog index, features, pricing and architecture
never request it. The post itself does not request it until a figure nears the
viewport.

**Engine impact: none, and someone will assume otherwise.** This is the
marketing site. It does not touch `app/`, it does not touch the `stamp_tool`
crate, and it cannot move the wasm sentinel band (ADR-037, ADR-038, ADR-045).
A marketing chunk and the wasm ceiling are measured in different builds that
share no bytes.

## Consequences

+ The post's three hardest ideas — which thread owns what, what crosses the
  wall, what the transfer costs — are shown instead of described, and FIG 4 can
  be stepped by the reader.
+ The dependency's whole surface is one 34-line file. Adding a class is one
  line; what the chunk contains is readable without a bundle analyzer.
+ The CSP is unchanged and no third party sits on the critical path of a page
  about keeping work on your own machine.
- **116,614 B gzipped is a lot for three figures in one blog post.** It is the
  **second-largest asset the site serves** — the main bundle is 221,674 B
  gzipped — and the largest that is on no route's critical path. A reader on a
  phone who scrolls to FIG 1 pays all of it, on a post that argues about
  performance.
- **three 0.165's `Color.setStyle` cannot parse `oklch`** (it handles rgb/hsl/
  hex/named and returns "Unknown color model"). So the ink and accent tokens
  are resolved at mount by painting each into a **1×1 canvas and reading the
  pixel back** — the browser's own oklch→sRGB with gamut clipping — behind a
  sentinel that catches a rejected `fillStyle`, falling back to the design's
  hex table. It looks like a workaround because it is one, and it is the first
  thing a future reader will try to delete.
- **At ≤40rem the annotation labels come off**, via
  `.scene__label--minor { display: none !important; }`. The `!important` is
  load-bearing: the scene writes `display` **inline** on those elements every
  frame as the beats turn them on and off, and an inline style beats an
  ordinary rule. Headings stay, the box goes 4:3, and the camera holds a
  constant *horizontal* field of view because three's `fov` is vertical and a
  narrower box was cropping the sides, which is where the meaning is.
- **Nothing tests the scenes.** No e2e, no visual check, no gate. A three
  version bump is therefore an unverifiable visual risk on a page nobody
  watches, and the exact pin is an admission of that rather than a policy.
- The tree-shake is a property of three's packaging, not of our build. One
  stray `from "three"` elsewhere in `marketing/src` roughly doubles the chunk,
  and **no gate would go red**.

## Alternatives rejected

1. **Load three from unpkg at runtime**, as the design export did. The
   marketing CSP forbids it outright, and a third-party CDN fetch on a post
   about privacy is a bad look even where it is legal.
2. **`@react-three/fiber`.** Rejected before any code was written: the design's
   scenes are imperative three.js, so fiber means rewriting all three of them,
   and it adds roughly 40 KB gzipped (estimate, not measured here) for no
   visual difference.
3. **Ship the figures as images or video.** This would have cost **no
   dependency and no chunk** — the honest cheapest option, and it was never
   seriously explored. What it gives up: FIG 4's four-beat control, the
   reader's ability to step the transfer, and figures that follow the theme
   tokens instead of being baked at one scale in one palette. A video large
   enough to read would also not obviously be smaller than 114 KiB.
4. **Keep the two static figures the post already had** — the real do-nothing
   baseline. The post was publishable; FIG 1 replaces a 30-line static boundary
   diagram that was correct, only inert.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: **the pin
became a freeze.** 0.165 is pinned exactly and nothing verifies the scenes, so
the first dependabot bump lands in front of a reviewer with no way to answer
"does FIG 4 still play?" short of opening a browser — and it sits. A year on,
a blog post's decoration is an unpatchable transitive on the marketing site's
dependency report, and the cheapest fix is the option we rejected without
exploring: replace the scenes with recordings of themselves. **The warning
sign is a `three` bump PR open for more than one dependabot cycle**, or a
reviewer merging one without having watched a figure.

Second most likely: the re-export module is bypassed. Someone adds a fourth
scene, reaches straight for `import { Fog } from "three"`, and the chunk
quietly takes on everything the 19-class whitelist was excluding. The warning
sign is `from "three"` appearing anywhere under `marketing/src` other than
`engine-in-a-worker.three.ts` — nothing else will notice, because the build
still succeeds and the only symptom is a bigger number in `dist/assets`.

*Amended 09-24-2026 by ADR-067, in v8.96:* the "one re-export module" rule had
already drifted when #219 added `posts/offline-by-construction.three.ts`, and
v8.96 moves three to 0.170.0 and puts two `three/webgpu` chunks on the home
page. The rule that holds now: every runtime `three` import lives in a
`*.three.ts` module reached only by dynamic `import()`, the pin stays exact,
and `three` and `three/webgpu` never share a scene. The 0.165 sizes above are
historical.
