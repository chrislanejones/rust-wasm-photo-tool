# ADR-085: Diagram shapes are new kind bytes, drawn from one program table
Date: 2026-10-06   Status: accepted (10-06-2026)   Relates to: ADR-059, ADR-082

## Context

Chris asked for the Arrow sub-tool to become "Arrows and Diagram Shapes", with
the thirty shapes people reach for most in Lucidchart and draw.io. Before this
the engine drew six bbox shapes, each with its own vertex function hand-mirrored
in TypeScript; thirty more written that way would be sixty hand-written
functions that have to agree.

## Decision

**1. Thirty new kinds, 11..=40, and nothing else in the model.** A diagram
shape is a `ShapeAnnotation` with a new `kind` byte and the existing bbox,
stroke, sloppiness, fill and rotation. The op log already carries `kind`
verbatim and never validated it, so **there is no op-log bump**: v11 logs
hold diagram shapes as they are.

| Group | Kinds |
|---|---|
| Flowchart | 11 terminator, 12 data, 13 document, 14 multiple documents, 15 predefined process, 16 manual input, 17 manual operation, 18 preparation, 19 database, 20 internal storage, 21 off-page connector, 22 delay, 23 display, 24 stored data, 25 merge, 26 card, 27 punched tape, 28 summing junction |
| Basic | 29 pentagon, 30 octagon, 31 cloud, 32 callout, 33 cross, 34 cube, 35 note |
| Block arrows | 36 block arrow, 37 double, 38 four-way, 39 chevron, 40 step |

Rectangle (process), diamond (decision), circle (connector) and triangle
(extract) were already Shapes and are not repeated.

**2. One table, two readers.** `src/diagram.rs` holds every shape as a short
program in the unit square: start outline, line, quadratic, elliptical arc, and
start an open detail stroke (a cylinder's rim, a cube's edges). `geometry()`
flattens it over the bbox to one closed outline plus details.
`app/src/lib/diagramShapes.ts` holds the same table and the same flattener;
`diagramShapes.parity.test.ts` reads the Rust source between the
`TABLE-BEGIN`/`TABLE-END` markers and fails when the two tables differ.

**3. Every existing route takes them unchanged.** The outline is what is
stroked, filled (`fill_shape` clips to it), rotated, and hit-tested (unfilled:
the outline edges; filled: the padded box, as for the diamond). Details are ink
only. A sketchy curved outline wobbles with `sloppy_loop_points` (the rounded-
corner rule); a straight one overshoots its corners like the diamond.

**4. The panel.** The Arrow sub-tool is "Arrows & Shapes": the Single/Double
arrow, then the thirty shapes in three groups, one pick across all of them
(`ToolSettings.arrowShape`, its own field so it does not move the Shapes tile).
The tiles are drawn from the same geometry.

## Consequences

- The `shape_annotation_at` drift hash moves (ef6242fa495acca1 →
  240ee76d785a4285), with the TS port and its tests updated first.
- WASM 858,966 → 868,541 B (+9,575), measured with the pinned binaryen 117.
- **Forward compatibility:** a build from before this change draws nothing for
  kinds 11..=40 (`draw_shape`'s `_ => {}`) and keeps them in the document. A
  document with diagram shapes opened on an older build shows them missing, not
  broken, and they come back on a current build.
- No corner radius on diagram shapes (`has_corners` stays 0/8/9/10).

**Pre-mortem warning sign:** a shape edited in only one of the two tables —
the parity test is the alarm; never update one table from the other's output.

## Outcome

| Date | What happened |
| --- | --- |
| 2026-10-06 | Shipped in v9.17 (#304). Engine 858,808 → 868,393 B in the release build. |
| 2026-10-06 | The first collision this ADR warned about happened the same day: #305, written in parallel, used kind **11** for the oval. Merged as-is, `draw_shape`'s `11 =>` arm would have drawn every terminator as an oval. The oval was moved to **kind 41** before it merged (942ec0d6), and the hit-test drift hash re-pinned (31c2e04289aa4ab2) after the port's tests passed. Engine 870,406 B with the oval. |
| Allocation now | 11..=40 diagram shapes, 41 oval. **The next free kind is 42.** The kind byte is still never validated, so a collision is silent: grep `is_diagram_kind`, `SHAPE_KIND_NAME` and `matches!(kind` on master before adding one. |
