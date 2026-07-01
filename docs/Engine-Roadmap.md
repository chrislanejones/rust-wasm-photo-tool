# Engine Roadmap

> Part of the [Image Horse](../README.md) docs. See also: [Architecture](Architecture.md) · [Architecture Roadmap](Architecture-Roadmap.md) · [Refactor Playbook](Refactor-Playbook.md).

Forward-looking engineering roadmap for the high-impact features that lean on the **Rust/WASM
engine** rather than React. Everything here is **aspirational and unscheduled** — nothing in this doc
is implemented yet. It exists to capture the design thesis, the level/feature tables, and the
recommended priority order in one place so the work can be specced and sequenced later.

The throughline: **push pixel- and stroke-math down into Rust** where it belongs (zero-copy, SIMD,
no GC pauses) and keep React as a thin event/forwarding layer. This pairs directly with the Rust
engine in [`src/lib.rs`](../src/lib.rs) (and the engine split described in the Refactor Playbook §10).

> Markers: this is a **design backlog**, not a punch-list. No file:line fixes, no guardrails — those
> come when each item graduates to its own spec.

## Contents

1. [Stroke Stabilizer (adaptive, Rust-side)](#1-stroke-stabilizer-adaptive-rust-side)
2. [Standout feature backlog (Rust/WASM-leaning)](#2-standout-feature-backlog-rustwasm-leaning)
3. [Selection tools overhaul (near-term)](#3-selection-tools-overhaul-near-term)

---

# 1. Stroke Stabilizer (adaptive, Rust-side)

**Thesis:** move nearly all stroke processing into Rust. React's only job becomes forwarding raw
input — `tool.pointer_move(x, y, pressure)` — and the engine owns buffering, smoothing, prediction,
and curve reconstruction. Today's stabilizer is a single flat dial (Off / Low / Med / High /
Extra-High) that just scales one number. The replacement is a **6-level adaptive system** where each
level runs a *different algorithm*, not merely a bigger constant.

## Levels

| Level           | Lag        | Smoothing   | Use case                                                         |
| --------------- | ---------- | ----------- | --------------------------------------------------------------- |
| Off             | 0 ms       | none        | signatures                                                      |
| Low             | 1–2 px     | tiny        | mouse                                                            |
| Medium          | 4–6 px     | average     | tablets                                                         |
| High            | 8–12 px    | strong      | shaky hands                                                     |
| Extra High      | 20+ px     | very strong | perfectly smooth art                                            |
| Assisted        | variable   | intelligent | "people who can't draw" — almost like drawing with a ruler      |

## Per-level algorithms

The level does **not** just scale a single strength constant — the math changes by tier:

- **Low / Medium / High — exponential smoothing.** `smoothed += (target - smoothed) * strength`,
  with strength **Low 0.65**, **Medium 0.35**, **High 0.18**, **Extra 0.08**.
- **Extra High — spline fitting.** Buffer ~25–40 points and **fit a spline every frame** (Rust is
  fast enough) instead of drawing the raw points.
- **Assisted — intent prediction.** Predict where the user is *trying* to go, giving a magnetic
  feel.

## Engine techniques

- **Velocity-based stabilizer (Rust)** — heavy smoothing when the pointer is slow, light when fast,
  so the brush doesn't lag behind quick strokes:

  ```rust
  let smoothing = if velocity < 2.0 {
      0.08
  } else if velocity < 10.0 {
      0.18
  } else {
      0.45
  };
  ```

- **Corner detection** — if `angle_change > 35°`, disable smoothing briefly so sharp corners
  survive instead of getting rounded off.
- **Predictive brush** — estimate the pointer position ~20 ms ahead so the brush feels *attached* to
  the cursor even under heavy stabilization.
- **Adaptive buffer** — slow movement buffers ~40 points, fast movement ~8, so the stroke never
  feels sluggish.
- **Bézier reconstruction** — rebuild the raw line-segment stream into quadratic / cubic Béziers.
- **Perfect Line Mode (hold Shift)** — Rust detects the dominant direction and snaps the stroke to
  horizontal / vertical / 45°.
- **Shape recognition** — a near-circle becomes a circle, a near-rectangle becomes a rectangle.
- **Pressure-aware stabilization (tablets)** — heavy pressure → less stabilization; light pressure →
  more.

## Recommended Rust architecture

The stroke pipeline runs end-to-end inside the WASM `StrokeEngine`; React only feeds it pointer
events:

```
React PointerMove
      │
      ▼
WASM StrokeEngine
      │
      ▼
 Point Buffer
      │
      ▼
Velocity Filter
      │
      ▼
 Spline Builder
      │
      ▼
Corner Detector
      │
      ▼
Adaptive Stabilizer
      │
      ▼
Bézier Generator
      │
      ▼
   Canvas
```

## Advanced panel

An **Advanced ▼** disclosure exposes the individual pipeline stages as toggles for power users:

- Lag Compensation
- Velocity Adaptive
- Corner Detection
- Predictive Brush
- Smart Bézier
- Shape Recognition

The default menu selection is **"✦ Assisted (Recommended)"**.

---

# 2. Standout feature backlog (Rust/WASM-leaning)

Twenty engine-leaning features, each a candidate to differentiate Image Horse. All are non-AI (or
AI-optional) and lean on Rust for the heavy pixel/geometry math.

1. **Smart Brush** — AI-free edge-aware painting: follow edges, stay inside objects, paint only
   sky/background, or paint hair strands — built from edge detection, flood fill, gradients, and
   masks.
2. **Infinite / operation-based Undo** — store *operations*, not pixel snapshots, and replay them in
   Rust. Tiny history footprint, and it unlocks macro recording plus an easier path to ORA export.
3. **Brush Physics** — wet / ink / marker / chalk / oil / airbrush / watercolor brushes driven by a
   particle simulation.
4. **Perspective Guides** — draw one line, derive vanishing points, and have strokes snap to the
   perspective.
5. **Live Symmetry** — vertical / horizontal / 4-way / 8-way / kaleidoscope / radial mirroring while
   you paint.
6. **Lazy Mouse** — the brush trails the cursor on a leash for steadier strokes.
7. **Infinite tiled Canvas** — 256×256 tiles where only the visible tiles exist in memory.
8. **Real-Time Object Selection** — flood fill + edge graphs + color clustering + region growing;
   faster than the magic wand and needs no AI.
9. **One-Click Cleanup** — straighten, de-artifact, denoise, sharpen, normalize, and remove dead
   pixels in a single pass.
10. **Brush Recorder** — capture speed / pressure / angle / spacing / size, replay the stroke, and
    export it as an SVG animation.
11. **Brush DNA** — brushes as recipes (texture / spacing / flow / pressure / scatter / noise /
    blend) exported as a `.brush` file for community sharing.
12. **Time Machine** — branching edit history; "git for images."
13. **Magnetic Selection** — draw loosely and the selection snaps to nearby edges.
14. **Stroke Cleanup** — rebuild a messy stroke into a perfect Bézier; great for signatures and line
    art.
15. **Auto Palette** — extract dominant / skin / shadow / highlight / complementary colors from the
    image.
16. **Instant Color Harmony** — generate complementary / analogous / split / triadic / monochrome
    schemes.
17. **Histogram Heat Map** — overlay crushed-shadow, blown-highlight, and clipped-channel zones
    directly on the image.
18. **Lens Correction Wizard** — correct barrel / pincushion distortion, horizon tilt, and
    perspective.
19. **Smart Crop** — find faces / eyes / horizon / rule-of-thirds / negative-space and suggest crops.
20. **Brush Prediction** — learn the user's tendencies over a session and adapt the stabilization to
    them.

## Top 10 priority

The author's recommended build order across the stabilizer and the backlog above:

1. Smart Brush
2. Assisted Stroke Stabilizer
3. Live Symmetry & Kaleidoscope
4. Infinite tiled canvas
5. Operation-based infinite undo / history
6. Histogram Heat Map overlay
7. Magnetic Selection & Smart Lasso
8. Stroke Cleanup to Bézier
9. One-click Photo Cleanup (non-AI)
10. Git-style edit branches (Time Machine)

---

# 3. Selection tools overhaul (near-term)

The current **Selection Marker** (a magic-wand flood-select) needs an overhaul, and additional
selection-tool *types* are wanted:

- Rectangle / ellipse marquee
- Freehand lasso
- Polygonal lasso
- Magnetic / edge-snapping lasso (ties to [#13 Magnetic Selection](#2-standout-feature-backlog-rustwasm-leaning)
  and [#8 Real-Time Object Selection](#2-standout-feature-backlog-rustwasm-leaning) above)

This is a **near-term design item** to be specced separately — it is the most concrete near-term
piece of the broader engine roadmap, and the magnetic lasso is the natural bridge between the
selection overhaul and the standout backlog.
