// The open textarea laid out as the ENGINE will lay out the text (ADR-106).
//
// The engine's drawing is the truth. `src/text.rs` builds glyphs at
// `PxScale::from(font_size)`, which ab_glyph reads as the face's
// ascent-to-descent HEIGHT; CSS `font-size` is the em. So at the same number
// the browser drew ~10% wider (Liberation Sans: 2048 / 2288 = 0.895), lines
// broke in different places in a box, and the text jumped on commit.
// Changing the engine would redraw every saved text, export and op-log replay,
// so the preview adapts instead, and every number it needs comes from the
// engine rather than a constant here:
//
//   em          = size * `text_em_ratio(font, bold)`   (units_per_em / height)
//   line pitch  = size * 1.3                            (`render_text_with`)
//   side pad    = ceil(size * 0.25)                     (`text::side_padding`)
//   pen origin  = where `commitText` will put the tile, from the SAME
//                 arithmetic (`alignShiftFrom` and the ink mapping), so the
//                 commit is untouched and the preview moves onto it
//
// Pure functions, no React and no engine handle: CanvasArea feeds them the
// cached metrics on the render path, useTextTool the awaited ones on commit.

/** `text::render_text_with`: lines are `font_size * 1.3` apart, in f32. */
const LINE_PITCH = Math.fround(1.3);

/** Screen px added to the top padding, measured: Chrome's baseline lands
 *  ~1 px above the engine's at the same computed position (see `engineTextarea`). */
const BASELINE_SNAP = 1;

/** `text::side_padding`: the engine's padding on each side of the ink. */
export function sidePadding(fontSize: number): number {
  return Math.ceil(fontSize * 0.25);
}

/** `text::render_text_with`'s block height for `lines` lines, before a box
 *  grows it: `(lines * line_height).ceil() + pad * 2`, in the engine's f32. */
export function engineBlockHeight(lines: number, fontSize: number): number {
  const lineHeight = Math.fround(fontSize * LINE_PITCH);
  return Math.max(1, Math.ceil(Math.fround(lines * lineHeight)) + 2 * sidePadding(fontSize));
}

/**
 * How far a centered or right-aligned text's anchor sits from where the
 * left-aligned ink mapping puts it, canvas px — the arithmetic of
 * `useTextTool`'s `alignAnchorShift`, moved here unchanged so the render path
 * can run the same numbers synchronously from cached metrics. See that
 * function for what each branch anchors on.
 *
 * `measured` is `measure_text` ([w, h]), `plain` is `text_ink_offset` with no
 * background ([x, y]), `contentCss` the no-box textarea's content width in
 * canvas px (`noBoxPreviewWidth` less its padding, over the scale), `padX`
 * the textarea's horizontal padding in canvas px. Returns 0 when a metric is
 * missing, as `alignAnchorShift` always has.
 */
export function alignShiftFrom(
  column: number,
  wrapWidth: number,
  fontSize: number,
  measured: readonly number[] | undefined,
  plain: readonly number[] | undefined,
  contentCss: number,
  padX: number,
): number {
  if (column === 0) return 0;
  if (wrapWidth <= 0) {
    if (!measured || !measured[0] || !plain) return 0;
    const sidePad = Math.ceil(fontSize * 0.25);
    // `text::measure`: the widest line plus `side_padding` a side, rounded UP
    // to a whole px; half a px is that rounding's expected overshoot.
    const widest = measured[0] - 2 * sidePad - 0.5;
    const bearing = plain[0] - sidePad;
    return bearing + (column === 1 ? (contentCss - widest) / 2 : contentCss - widest);
  }
  // The first glyph's inset with no background: the engine's side padding
  // plus the glyph's own bearing. The background margin cancels out.
  if (!plain) return 0;
  return column === 1 ? plain[0] - padX : plain[0] + Math.ceil(fontSize * 0.25) - 2 * padX;
}

export interface EngineTextareaInput {
  /** The text input's anchor, canvas px (`textInput.canvasX/Y`). */
  canvasX: number;
  canvasY: number;
  /** Screen px per canvas px. */
  scaleX: number;
  scaleY: number;
  /** The tool's size: the ENGINE's size, what the panel shows. */
  fontSize: number;
  /** `text_em_ratio` for the face and weight. */
  emRatio: number;
  /** `text_ink_offset` with no background: [x, y] of the first line's ink. */
  plainInk: readonly number[];
  /** `alignShiftFrom` for this text, canvas px. */
  shift: number;
  /** 0 left, 1 center, 2 right; 0 top, 1 middle, 2 bottom (ADR-104). */
  column: number;
  row: number;
  /** The box, canvas px; 0 = none. */
  wrapWidth: number;
  boxHeight: number;
  /** Lines after the engine's wrap. */
  lines: number;
  /** No box: the engine's widest line, canvas px. */
  widest: number;
  /** The textarea's padding constants, screen px (TEXT_OVERLAY_PAD_X/_Y). */
  padX: number;
  padY: number;
}

export interface EngineTextarea {
  /** The textarea's top-left, screen px from the text input's anchor. */
  dx: number;
  dy: number;
  style: {
    width: number;
    minHeight: number;
    fontSize: number;
    lineHeight: string;
    padding: string;
    whiteSpace: "pre" | "pre-wrap";
    overflowWrap: "normal";
    fontKerning: "none";
    fontVariantLigatures: "none";
    textRendering: "geometricPrecision";
  };
}

/**
 * The textarea's box, font and padding such that its glyphs are drawn where
 * `commitText` will commit them.
 *
 * The commit stores the tile at
 *   `round(canvasX + padX / scaleX - ink[0] + shift)`,
 *   `round(canvasY + padY / scaleY - ink[1])`,
 * and with a background `ink` grows by exactly the margin the tile adds, so
 * the TEXT's origin is that expression on the no-background ink. Inside it
 * the engine puts each line's pen at `side_padding`, its first baseline at
 * `side_padding + ascent` (lower by the box's spare height for the middle and
 * bottom rows), the next ones `1.3 * size` apart, and aligns lines in the
 * box's content width (`box - 2 * side_padding`) or, with no box, against the
 * widest line. This puts the textarea's CONTENT box exactly there:
 *
 *   - padding left and right = `side_padding`, so the content box is the
 *     engine's and the browser wraps and aligns in the same width;
 *   - `font-size` = size * emRatio, so the em, and every advance, is the
 *     engine's;
 *   - `line-height` = 1.3 * size in px (NOT 1.3 em: that is the engine's
 *     size, not its em). CSS centers the face's ascent + descent — which at
 *     this em is exactly `size` — in that line, so the first baseline sits
 *     `0.15 * size` below the content top; the top padding takes that off
 *     (and adds `BASELINE_SNAP`).
 *
 * Kerning and ligatures are off and the advances unhinted
 * (`geometricPrecision`), because ab_glyph applies none of them: the bundled
 * Liberation faces kern only through GPOS, which it does not read.
 */
export function engineTextarea(i: EngineTextareaInput): EngineTextarea {
  const pad = sidePadding(i.fontSize);
  const originX = Math.round(i.canvasX + i.padX / i.scaleX - i.plainInk[0] + i.shift);
  const originY = Math.round(i.canvasY + i.padY / i.scaleY - i.plainInk[1]);
  const block = engineBlockHeight(i.lines, i.fontSize);
  const spare = i.boxHeight > block ? i.boxHeight - block : 0;
  const rowOffset = i.row === 1 ? Math.floor(spare / 2) : i.row === 2 ? spare : 0;
  const content = i.wrapWidth > 0 ? i.wrapWidth - 2 * pad : i.widest;
  // + BASELINE_SNAP: measured, not derived. At the baseline this model
  // computes, Chrome's glyphs sit about 1 px above ab_glyph's (Chrome draws
  // the baseline on a whole pixel, the engine's is fractional). 11-18, 52
  // lines over three faces at 24-96: with 0 every line's top was 1 px high,
  // with 0.5 most still were, with 1 the tops agree on 43 of 52 and the rest
  // are within 1 px.
  const top = (pad + rowOffset - (LINE_PITCH - 1) * i.fontSize / 2) * i.scaleY + BASELINE_SNAP;
  return {
    dx: (originX - i.canvasX) * i.scaleX,
    dy: (originY - i.canvasY) * i.scaleY,
    style: {
      width: (content + 2 * pad) * i.scaleX,
      minHeight: Math.max(block, i.boxHeight) * i.scaleY,
      fontSize: i.fontSize * i.emRatio * i.scaleX,
      lineHeight: `${i.fontSize * LINE_PITCH * i.scaleY}px`,
      padding: `${top}px ${pad * i.scaleX}px ${pad * i.scaleY}px`,
      // No box: the engine never wraps, so neither may the preview, however
      // the last fraction of a pixel rounds.
      whiteSpace: i.wrapWidth > 0 ? "pre-wrap" : "pre",
      // A word longer than the box stays whole, as `text::wrap` leaves it.
      overflowWrap: "normal",
      fontKerning: "none",
      fontVariantLigatures: "none",
      textRendering: "geometricPrecision",
    },
  };
}

/** A `measureText` at `font` the way the engine measures: no kerning and
 *  unhinted advances. For the preview's line breaks (`wrapPreviewLines`) at
 *  the engine's em. */
export function engineMeasure(font: string): (text: string) => number {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return () => 0;
  ctx.font = font;
  ctx.fontKerning = "none";
  ctx.textRendering = "geometricPrecision";
  return (text) => ctx.measureText(text).width;
}

/** Lines the engine draws for the preview's wrapped `lines` of `text`: Rust's
 *  `str::lines` drops a trailing empty line, which `split("\n")` keeps. */
export function engineLineCount(text: string, lines: number): number {
  return text.endsWith("\n") ? lines - 1 : lines;
}

/**
 * `engineTextarea` from what CanvasArea has on its render path, or `null`
 * when a metric is not cached yet — the caller keeps the pre-ADR-106 layout
 * for that one frame, and `primeTextMetrics` fills the cache for the next.
 *
 * `align` is the engine's alignment byte (`textAlignEngineArg`), `noBoxWidth`
 * the no-box textarea width in screen px (`noBoxPreviewWidth`), which the
 * commit's Center and Right anchors are measured against. `wrapped` are the
 * preview's lines after `wrapPreviewLines` and `measure` the `engineMeasure`
 * that broke them (screen px).
 *
 * Also returns the engine's text block in screen px (`plate`), which is what a
 * background plate surrounds: the box width for centered and right text in a
 * box, else the widest line plus the side padding (`text::render_text_with`).
 */
export function previewTextarea(a: {
  text: string;
  canvasX: number;
  canvasY: number;
  scaleX: number;
  scaleY: number;
  fontSize: number;
  emRatio: number | undefined;
  plainInk: readonly number[] | undefined;
  measured: readonly number[] | undefined;
  align: number;
  wrapWidth: number;
  boxHeight: number;
  wrapped: readonly string[];
  measure: (line: string) => number;
  noBoxWidth: number;
  padX: number;
  padY: number;
}): (EngineTextarea & { plate: { width: number; height: number } }) | null {
  if (!a.emRatio || !a.plainInk || (a.wrapWidth <= 0 && !a.measured?.[0])) return null;
  const column = a.align % 3;
  const s = a.scaleX || 1;
  const sy = a.scaleY || 1;
  const pad = sidePadding(a.fontSize);
  // The same three arguments `alignAnchorShift` reads on commit, from the
  // same cache entries — so the preview is laid out on the commit's anchor.
  const contentCss = (a.noBoxWidth - 2 * a.padX) / s;
  const shift = alignShiftFrom(column, a.wrapWidth, a.fontSize, a.measured, a.plainInk, contentCss, a.padX / s);
  const widest = a.measured?.[0] ? a.measured[0] - 2 * pad - 0.5 : 0;
  const lines = engineLineCount(a.text, a.wrapped.length);
  const area = engineTextarea({
    ...a,
    scaleX: s,
    scaleY: sy,
    emRatio: a.emRatio,
    plainInk: a.plainInk,
    shift,
    column,
    row: Math.floor(a.align / 3),
    lines,
    widest,
  });
  const blockW =
    a.wrapWidth <= 0 ? (a.measured?.[0] ?? 0)
    : column !== 0 ? a.wrapWidth
    : Math.ceil(Math.max(0, ...a.wrapped.map(a.measure)) / s) + 2 * pad;
  const blockH = Math.max(engineBlockHeight(lines, a.fontSize), a.boxHeight);
  return { ...area, plate: { width: blockW * s, height: blockH * sy } };
}
