/**
 * SVG → SVG pass-through: crop an uploaded SVG and download it as an SVG.
 *
 * The editor never holds a vector. `rasterizeSvg.ts` turns every SVG into PNG
 * pixels at the import boundary, and that stays true — the pixels are what is
 * edited, shown and stored. What this file adds is a SIDE CHANNEL: the SVG's
 * own text is kept (as a string, never rendered — see `useSvgSourceStore`),
 * and every crop is recorded as a rectangle in the SVG's user units. Export
 * then writes the ORIGINAL markup back out with only the root `<svg>` tag's
 * `viewBox` / `width` / `height` changed. Nothing is re-encoded, nothing is
 * traced; the file that comes out is the file that went in, framed tighter.
 *
 * WHAT CARRIES OVER: crops (every crop path records one) and uniform resizes
 * (a vector does not care; the frame is the same picture at any size).
 * WHAT DOES NOT: painting, filters, text, rotation — they exist only in the
 * pixels. When the document's shape no longer matches any recorded frame (a
 * rotate, a canvas resize), `resolveDocFrame` answers null and SVG export is
 * refused for that image rather than writing a file that silently disagrees
 * with what was on screen.
 *
 * Pure string work — no DOMParser — so it runs (and is tested) in node, and so
 * the bytes outside the root tag are guaranteed untouched.
 */

/** A rectangle in the SVG's user units (viewBox space). */
export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One recorded crop: after it, at `undoCount`, a `docW`×`docH` document
 *  showed exactly `frame` of the SVG. */
export interface SvgCropRecord {
  undoCount: number;
  docW: number;
  docH: number;
  frame: Frame;
}

/** Everything kept per SVG image. */
export interface SvgSource {
  /** The uploaded markup, verbatim. */
  text: string;
  /** The user-unit region the whole rasterized image covers (the viewBox, or
   *  more than it when preserveAspectRatio letterboxed it). */
  imageFrame: Frame;
  /** The working-copy pixel size `imageFrame` maps onto. */
  imageW: number;
  imageH: number;
  /** The user-unit region the photo's CURRENT stored pixels cover. Starts as
   *  `imageFrame`; Batch › Crop on a non-active photo replaces the stored
   *  original, and moves this with it. */
  baseFrame: Frame;
  /** Photo pixel size `baseFrame` maps onto (the working copy's size). */
  baseW: number;
  baseH: number;
  /** Crops on the live document, oldest → newest. */
  crops: SvgCropRecord[];
}

// ── Root tag parsing ───────────────────────────────────────────────────────

interface RootTag {
  /** Offset of `<svg` in the text. */
  start: number;
  /** Offset just past the tag's closing `>`. */
  end: number;
  attrs: Map<string, string>;
}

/** Find the document's root `<svg ...>` start tag, skipping the prolog (XML
 *  declaration, comments, DOCTYPE with an internal subset). Quote-aware, so a
 *  `>` inside an attribute value does not end the tag. */
export function findRootSvgTag(text: string): RootTag | null {
  let i = 0;
  const n = text.length;
  while (i < n) {
    const lt = text.indexOf("<", i);
    if (lt < 0) return null;
    if (text.startsWith("<?", lt)) {
      const e = text.indexOf("?>", lt);
      if (e < 0) return null;
      i = e + 2;
      continue;
    }
    if (text.startsWith("<!--", lt)) {
      const e = text.indexOf("-->", lt);
      if (e < 0) return null;
      i = e + 3;
      continue;
    }
    if (text.startsWith("<!", lt)) {
      // DOCTYPE — may carry an internal subset in [...].
      let j = lt + 2;
      let depth = 0;
      while (j < n) {
        const c = text[j];
        if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) break;
        j++;
      }
      i = j + 1;
      continue;
    }
    // The first element. It is the root, and it must be an <svg>.
    if (!/^<(?:[\w.-]+:)?svg[\s/>]/i.test(text.slice(lt, lt + 16))) return null;
    let j = lt + 1;
    let quote: string | null = null;
    while (j < n) {
      const c = text[j];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === ">") {
        break;
      }
      j++;
    }
    if (j >= n) return null;
    const inner = text.slice(lt, j);
    const attrs = new Map<string, string>();
    const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inner))) {
      attrs.set(m[1], m[3] ?? m[4] ?? "");
    }
    return { start: lt, end: j + 1, attrs };
  }
  return null;
}

function parseViewBox(v: string | undefined): Frame | null {
  if (!v) return null;
  const nums = v.trim().split(/[\s,]+/).map(Number);
  if (nums.length !== 4 || nums.some((x) => !Number.isFinite(x))) return null;
  const [x, y, w, h] = nums;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/** A width/height attribute as number + unit. Percentages are not a size. */
function parseLength(v: string | undefined): { value: number; unit: string } | null {
  if (!v) return null;
  const m = v.trim().match(/^([+]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|em|ex)?$/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  return value > 0 ? { value, unit: m[2] ?? "" } : null;
}

interface AspectRule {
  none: boolean;
  slice: boolean;
  /** 0 = min, 0.5 = mid, 1 = max, per axis. */
  ax: number;
  ay: number;
}

function parseAspect(v: string | undefined): AspectRule {
  const s = (v ?? "").trim();
  if (/^none\b/.test(s)) return { none: true, slice: false, ax: 0, ay: 0 };
  const m = s.match(/x(Min|Mid|Max)Y(Min|Mid|Max)/);
  const pos = (t: string | undefined) => (t === "Min" ? 0 : t === "Max" ? 1 : 0.5);
  return {
    none: false,
    slice: /\bslice\b/.test(s),
    ax: pos(m?.[1]),
    ay: pos(m?.[2]),
  };
}

/** The viewBox the root declares, or one implied by a unitless/px size. */
function effectiveViewBox(attrs: Map<string, string>): Frame | null {
  const vb = parseViewBox(attrs.get("viewBox"));
  if (vb) return vb;
  const w = parseLength(attrs.get("width"));
  const h = parseLength(attrs.get("height"));
  if (!w || !h) return null;
  if ((w.unit !== "" && w.unit !== "px") || (h.unit !== "" && h.unit !== "px")) return null;
  return { x: 0, y: 0, w: w.value, h: h.value };
}

/**
 * Prepare an uploaded SVG for pass-through, given the size it was rasterized
 * at. Returns null when the SVG has no geometry we can map pixels back onto
 * (no viewBox and no absolute size) — such an image still imports, it just
 * cannot be exported as SVG.
 *
 * `rasterW`×`rasterH` is the raster's size; `workingW`×`workingH` the editor's
 * working copy (the same picture, possibly downscaled).
 */
export function prepareSvgSource(
  text: string,
  workingW: number,
  workingH: number,
  rasterW: number = workingW,
  rasterH: number = workingH,
): SvgSource | null {
  const root = findRootSvgTag(text);
  if (!root) return null;
  const vb = effectiveViewBox(root.attrs);
  if (!vb || rasterW <= 0 || rasterH <= 0 || workingW <= 0 || workingH <= 0) return null;

  // Which user-unit rectangle the raster covers. The rasterizer drew the SVG
  // into a rasterW×rasterH viewport, and preserveAspectRatio decides how the
  // viewBox sits in it — stretched (none), or scaled uniformly and aligned
  // with the leftover as a transparent margin (meet) or cut off (slice).
  const ar = parseAspect(root.attrs.get("preserveAspectRatio"));
  let imageFrame: Frame;
  if (ar.none) {
    imageFrame = { ...vb };
  } else {
    const sx = rasterW / vb.w;
    const sy = rasterH / vb.h;
    const s = ar.slice ? Math.max(sx, sy) : Math.min(sx, sy);
    const fw = rasterW / s;
    const fh = rasterH / s;
    imageFrame = {
      x: vb.x - (fw - vb.w) * ar.ax,
      y: vb.y - (fh - vb.h) * ar.ay,
      w: fw,
      h: fh,
    };
  }
  return {
    text,
    imageFrame,
    imageW: workingW,
    imageH: workingH,
    baseFrame: imageFrame,
    baseW: workingW,
    baseH: workingH,
    crops: [],
  };
}

// ── Frame bookkeeping ──────────────────────────────────────────────────────

/** Same aspect ratio, allowing for the pixel rounding a resize introduces. */
function sameShape(aw: number, ah: number, bw: number, bh: number): boolean {
  if (aw === bw && ah === bh) return true;
  // Cross-multiplied, with one pixel of slack on the larger side.
  return Math.abs(aw * bh - bw * ah) <= Math.max(aw, ah, bw, bh);
}

/**
 * The user-unit rectangle a `docW`×`docH` document shows, at `undoCount`.
 *
 * Newest crop record at or before `undoCount` whose shape matches wins — the
 * shape check is what makes a record that was undone and then overwritten by
 * some other edit at the same undo depth fall through instead of lying. With
 * no record, the document is the photo itself: exactly its base size, the
 * same shape (resized), or padded evenly on every side by the import artboard
 * (ADR-016), in which case the frame grows by the padding.
 *
 * Null when none of those hold: the document is no longer a crop of the SVG.
 */
export function resolveDocFrame(
  src: SvgSource,
  undoCount: number,
  docW: number,
  docH: number,
): Frame | null {
  for (let i = src.crops.length - 1; i >= 0; i--) {
    const r = src.crops[i];
    if (r.undoCount <= undoCount && sameShape(r.docW, r.docH, docW, docH)) return r.frame;
  }
  const { baseFrame: f, baseW, baseH } = src;
  const padX = docW - baseW;
  const padY = docH - baseH;
  if (padX >= 0 && padX === padY && padX % 2 === 0) {
    const p = padX / 2;
    const ux = f.w / baseW;
    const uy = f.h / baseH;
    return { x: f.x - p * ux, y: f.y - p * uy, w: f.w + 2 * p * ux, h: f.h + 2 * p * uy };
  }
  if (sameShape(baseW, baseH, docW, docH)) return f;
  return null;
}

/** The part of `frame` a pixel rect `(x, y, w, h)` of a `docW`×`docH`
 *  document covers. Clamped the way the engine clamps a crop. */
function subFrame(
  frame: Frame,
  docW: number,
  docH: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Frame {
  const cx = Math.max(0, Math.min(x, docW - 1));
  const cy = Math.max(0, Math.min(y, docH - 1));
  const cw = Math.max(1, Math.min(w, docW - cx));
  const ch = Math.max(1, Math.min(h, docH - cy));
  const ux = frame.w / docW;
  const uy = frame.h / docH;
  return { x: frame.x + cx * ux, y: frame.y + cy * uy, w: cw * ux, h: ch * uy };
}

/**
 * Record a crop. `before` is the document ahead of it, `after` what the engine
 * reports once it ran. Records at or past the new undo depth are dropped first
 * — they describe a redo branch this crop just discarded.
 *
 * Returns the source unchanged when the document ahead of the crop was not a
 * crop of the SVG (nothing to extend), so later records cannot be built on a
 * frame that was already wrong.
 */
export function recordCrop(
  src: SvgSource,
  before: { undoCount: number; w: number; h: number },
  rect: { x: number; y: number; w: number; h: number },
  after: { undoCount: number; w: number; h: number },
): SvgSource {
  const crops = src.crops.filter((r) => r.undoCount < after.undoCount);
  const from = resolveDocFrame({ ...src, crops }, before.undoCount, before.w, before.h);
  if (!from) return { ...src, crops };
  const frame = subFrame(from, before.w, before.h, rect.x, rect.y, rect.w, rect.h);
  return {
    ...src,
    crops: [...crops, { undoCount: after.undoCount, docW: after.w, docH: after.h, frame }],
  };
}

/** Batch › Crop on a photo that is not open: it re-crops the photo's ORIGINAL
 *  and stores the result as the new original, with no undo history. So the
 *  base itself moves, measured on the uncropped image. */
export function rebaseOnOriginalCrop(
  src: SvgSource,
  rect: { x: number; y: number; w: number; h: number },
  outW: number,
  outH: number,
): SvgSource {
  // Measured on the untouched original, whatever an earlier batch crop did.
  const frame = subFrame(src.imageFrame, src.imageW, src.imageH, rect.x, rect.y, rect.w, rect.h);
  return { ...src, baseFrame: frame, baseW: outW, baseH: outH, crops: [] };
}

function intersect(a: Frame, b: Frame): Frame | null {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

function nearly(a: Frame, b: Frame): boolean {
  const eps = 1e-6 * Math.max(Math.abs(a.w), Math.abs(a.h), 1);
  return (
    Math.abs(a.x - b.x) <= eps &&
    Math.abs(a.y - b.y) <= eps &&
    Math.abs(a.w - b.w) <= eps &&
    Math.abs(a.h - b.h) <= eps
  );
}

/** Six significant digits, no trailing zeros — enough for any viewBox. */
function num(v: number): string {
  const r = Number(v.toPrecision(6));
  return Object.is(r, -0) ? "0" : String(r);
}

function setAttr(tag: string, name: string, value: string): string {
  const re = new RegExp(`(\\s${name}\\s*=\\s*)("[^"]*"|'[^']*')`);
  if (re.test(tag)) return tag.replace(re, `$1"${value}"`);
  // Insert right after the element name.
  return tag.replace(/^<([\w:.-]+)/, `<$1 ${name}="${value}"`);
}

/**
 * Write the SVG for a document that shows `docFrame`. Only the part of the
 * frame that is the photo counts — the import artboard's padding is not in the
 * SVG, the same as the raster export's "Photo only".
 *
 * Returns the original text UNCHANGED when the frame is the whole image, and
 * null when the frame misses the image entirely.
 */
export function writeCroppedSvg(src: SvgSource, docFrame: Frame): string | null {
  const frame = intersect(docFrame, src.imageFrame);
  if (!frame) return null;
  if (nearly(frame, src.imageFrame)) return src.text;

  const root = findRootSvgTag(src.text);
  if (!root) return null;
  let tag = src.text.slice(root.start, root.end);
  tag = setAttr(tag, "viewBox", `${num(frame.x)} ${num(frame.y)} ${num(frame.w)} ${num(frame.h)}`);

  // Size scales with the crop, in the file's own unit, so a 200px-wide icon
  // cropped to its left half comes out 100px wide. A root with no size keeps
  // none and takes its aspect from the new viewBox.
  const w = parseLength(root.attrs.get("width"));
  const h = parseLength(root.attrs.get("height"));
  const imgFrame = src.imageFrame;
  if (w) tag = setAttr(tag, "width", `${num((w.value * frame.w) / imgFrame.w)}${w.unit}`);
  if (h) tag = setAttr(tag, "height", `${num((h.value * frame.h) / imgFrame.h)}${h.unit}`);
  return src.text.slice(0, root.start) + tag + src.text.slice(root.end);
}
