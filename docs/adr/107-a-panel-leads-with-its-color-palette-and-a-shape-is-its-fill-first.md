# ADR-107: A panel leads with its color palette, and a shape is its fill first
Date: 2026-11-19   Status: draft (`claude/wizardly-feynman-6s8u7r`)   Relates to: ADR-029, ADR-065, ADR-070, ADR-085

## Context

The Shapes panel read tiles → Points → Corner Radius → Stroke Width →
Sloppiness → Stroke Color → **Fill ▸** (None | Solid | Gradient | Pixelate,
None by default). A new rectangle was a red 3 px outline with nothing in it,
its color was the sixth control down, and its fill was a closed dropdown
under that. Chris, 11-19-2026: lead with the color, call it **Fill Color**,
fill a new shape with the palette's first color, put the stroke in a
dropdown with **Stroke Color** and **Stroke Width**, and "default stroke is
none"; "this is a new design system choice to put the color palette first".
For Arrows & Diagram Shapes: the palette as **Stroke Color**, then Stroke
Width, "unless you think all those should change too".

Two things stood in the way. `strokeColor` / `strokeWidth` / `fillMode` /
`fillColor` are ONE set shared by the Shapes tiles, the line, the arrow, the
diagram shapes, the pins (whose size is `strokeWidth`) and the Pen, so a
square's "no stroke" would have been the next arrow's. And nothing had ever
sent the engine a width of 0: the slider started at 1.

## Decision

1. **The color palette is a panel's first control row** (UI_CONSISTENCY §8),
   under the primary control and above every slider, named for what it
   colors: Fill Color, Stroke Color. Applied to the Shapes tool's three tabs
   now; Paint › Pen, the Brush and Text follow when each is next touched.
2. **The Shapes tab's shapes with an interior are fill first** — rect,
   circle, oval, diamond, star, triangle (`FILL_FIRST_KINDS`). Panel: Fill
   Color · Points (star) · Corner Radius · Sloppiness · **Stroke ▸**. A new
   one is a solid fill in `TEXT_COLORS[0]` (white) with no stroke. The Fill
   dropdown leaves this tab.
3. **Stroke is a closed section** (the Placement pattern): Stroke Color,
   then Stroke Width with presets None / 2 / 4 / 8. The shut header reads
   `None` or `4 px`. Picking a color while the stroke is None turns it on at
   2 px, so a click is never a no-op.
4. **Arrows, diagram shapes, the line and pins stay stroke first**: Stroke
   Color, then Stroke Width. An arrow and a line are only a stroke. A diagram
   shape fills too, but half of them carry detail strokes (a subprocess's
   bars, a database's lid) that a strokeless shape would lose, and a
   flowchart is read by its outlines. They keep the Fill dropdown, None by
   default.
5. **Two style sets, one function that picks.** `shapeFillMode`,
   `shapeFillColor`, `shapeStrokeColor`, `shapeStrokeWidth` join
   `ToolSettings` for the fill-first kinds; everything else keeps the shared
   four. `drawEditState.panelShapeStyle(settings, kind)` is the only place
   that chooses, and the commit, the rubber band, the edit overlay
   (`shapeDrawSettings`), the reselect sync (`panelFieldsForStyle`) and the
   restyle diff (`panelStylePatch`, now given the kind) all read it.
6. **Width 0 means no stroke, in the engine.** `drawing::draw_shape` returns
   before stroking at `stroke_width <= 0`, and an image resize no longer
   floors a 0 width up to the 0.5 px hairline. No new field and no op-log
   version: `stroke_width` was already an `f64` on `Op::AddShape` and in the
   archive, and no log written before today holds a 0 for these kinds.

## Consequences
+ The first thing under the tiles is the thing most often changed, and the
  default shape is visible on any photo without touching a control.
+ A square's stroke and the next arrow's are independent: None on one does
  not make the other invisible, and reselecting one does not restyle the
  other tab's panel.
+ Older shapes are untouched. An outline-only, gradient or pixelate shape
  reselects with its own style (`shapeFillMode` carries the mode; no swatch
  is lit), moves and resizes with it, and becomes a solid only when a Fill
  Color is picked. Its stroke cannot be set to None while it has no fill.
- **Outline-only, Gradient and Pixelate can no longer be chosen for a NEW
  rect, circle, oval, diamond, star or triangle.** The engine still draws all
  three and the diagram shapes still offer them, but a hollow rectangle
  around something — the commonest screenshot annotation — now needs a
  stroke turned on and has no way to turn the fill off. This is the cost of
  "fill will be taken away" as asked; the smallest repair is a "no fill"
  swatch at the head of Fill Color.
- Sloppiness roams the stroke only, so on the default (strokeless) shape the
  slider changes nothing visible.
- A build from before this ADR that replays a log holding a width-0 shape
  strokes it at width 0, which `draw_line_thick` renders as a dotted outline.
- Connect from a strokeless shape has no stroke to copy, so the connector
  takes the Arrows panel's color and width.
- A white fill dragged over a white page was invisible until release, so the
  rubber band of a strokeless shape draws a two-tone dashed guide
  (`drawShapePreview`). It is the band's only; nothing of it is committed.
- wasm size not measured: this session could not fetch the pinned binaryen
  117, so no optimized build was made. The Rust change is two guards.

## Alternatives rejected
- **One shared stroke width, clamped to ≥ 1 for arrows:** the Arrows slider
  would show a value the arrow is not drawn with.
- **Diagram shapes fill first too:** see Decision 4.
- **A new `stroke_kind` byte on the shape:** an op-log version and a fixture
  for what a width of 0 already says.
- **Bind the line's color to Fill Color:** a line has no fill; reselecting
  one would have written its stroke into the fill fields of the next square.
