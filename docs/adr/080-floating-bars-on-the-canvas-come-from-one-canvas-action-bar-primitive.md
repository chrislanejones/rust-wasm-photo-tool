# ADR-080: Floating bars on the canvas come from one CanvasActionBar primitive

Date: 2026-10-05   Status: draft   Relates to: ADR-079

## Context

Floating action bars on or under the canvas were built per tool.
`PerspectiveActionBar` (Perspective / Distort / Skew) carried its own local
`BarButton`. Batch's canvas grid (`GridThumbnails`) needed a bar of its own
too: the grid has 12 cells (hero + 11 tiles), so a bigger gallery only got a
"+N more" badge and had no way to page. Chris asked for one multipurpose
element he can reuse.

## Decision

`app/src/components/ui/canvas-action-bar.tsx` exports `CanvasActionBar`,
`CanvasActionBarButton` and `CanvasActionBarText`. The caller passes an
anchor point in screen px (`x`, `y` = top-center) plus children. The
component owns the look, clamps itself to the viewport using its measured
size (`ResizeObserver`), keeps its outer box pointer-transparent, and stops
`pointerdown` propagation on its buttons. Placement variants (under a quad,
under the grid) are allowed. `PerspectiveActionBar` now renders through it.
`GridThumbnails` uses it for a bar under the grid: ‹ › paging, 11 tiles per
page around the hero, plus a photo / exception count. The "+N more" badge is
removed. Each grid tile gets its own Exception checkbox
(`BatchExceptionCheckbox` now takes `photoId`). No Rust, no IndexedDB.

## Consequences

+ One look and one set of pointer rules for every canvas bar, instead of
  copies that drift.
+ Batch galleries over 11 photos are reachable from the canvas.
- Positions come from measured rects, so the bar follows layout through
  `ResizeObserver` / resize only. It does not track scroll containers.
- A third "action bar" name in the repo (beside `PanelActionBar`), so the
  canvas/panel split has to stay obvious to callers.

## Alternatives rejected

- Keep per-tool bars: they drift (`PerspectiveActionBar` already had a
  private `BarButton`).
- Reuse `PanelActionBar`: it is built for the sidebar, not for a point on
  the canvas.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the
anchor-point API was too thin. A bar that needs to sit inside a scrolled or
transformed container (zoomed canvas, panned grid) drifts off its anchor,
and each caller patches it with its own offset math. The shared primitive
then hides per-caller layout code instead of removing it.
Early warning sign to watch for: a caller computing scroll or zoom offsets
before passing `x` / `y`, or a second local button component appearing
next to a `CanvasActionBar`.
