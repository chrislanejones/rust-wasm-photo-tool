/**
 * Paste SVG (the New dialog's sixth tile): turn SVG code pasted as TEXT into an
 * `.svg` File that goes through the same import as a dropped `.svg`.
 *
 * Nothing here renders the markup. The only changes are to the root `<svg>`
 * tag: its width/height become the canvas size chosen in the step, and the
 * namespace a browser needs to read it as an image is added when the paste
 * left it off. Code copied out of a web page (an inline icon) usually has no
 * `xmlns`. Inline in HTML that is fine, but an `<img>` parses the file as XML
 * and shows nothing. A background, when chosen, is one `<rect>` laid under
 * everything else.
 *
 * The result then takes the normal path (lib/rasterizeSvg → PNG pixels, with
 * the text kept on the side for SVG → SVG export, lib/svgPassthrough), so a
 * pasted SVG is the same as a dropped one in every way except its size.
 *
 * Pure string work, so it runs (and is tested) in node.
 */
import {
  effectiveViewBox,
  findRootSvgTag,
  setAttr,
  type Frame,
} from "@/lib/svgPassthrough";

/** The same size rule a dropped SVG gets (lib/rasterizeSvg): a 24px icon is
 *  scaled up so it stays editable, and a huge one comes down. */
const MIN_LONG_SIDE = 1024;
const MAX_LONG_SIDE = 4096;
/** The largest side the step lets you type. Past this a browser canvas starts
 *  refusing to draw. */
export const PASTED_SVG_MAX_SIDE = 8192;

export type PastedSvg =
  | { kind: "empty" }
  | { kind: "invalid"; message: string }
  | {
      kind: "ok";
      /** The trimmed paste. */
      text: string;
      /** The drawing's own frame in user units, or null when the code gives
       *  no viewBox and no absolute size. */
      frame: Frame | null;
      /** width / height of the drawing (1 when it has no frame). */
      aspect: number;
      /** The canvas size the step starts with. */
      suggested: { w: number; h: number };
    };

/** Read a paste: is it SVG code, and what size does it want to be? */
export function readPastedSvg(raw: string): PastedSvg {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  const root = findRootSvgTag(text);
  if (!root) {
    return { kind: "invalid", message: "That isn't SVG code. It should start with <svg." };
  }
  if (/\/\s*>$/.test(text.slice(root.start, root.end))) {
    return { kind: "invalid", message: "This <svg> is empty. There is nothing inside it to draw." };
  }
  const frame = effectiveViewBox(root.attrs);
  const aspect = frame ? frame.w / frame.h : 1;
  const w0 = frame?.w ?? MIN_LONG_SIDE;
  const h0 = frame?.h ?? MIN_LONG_SIDE;
  const long = Math.max(w0, h0);
  const scale = long < MIN_LONG_SIDE ? MIN_LONG_SIDE / long : long > MAX_LONG_SIDE ? MAX_LONG_SIDE / long : 1;
  return {
    kind: "ok",
    text,
    frame,
    aspect,
    suggested: { w: Math.max(1, Math.round(w0 * scale)), h: Math.max(1, Math.round(h0 * scale)) },
  };
}

/** The other side of the canvas for a typed side, keeping the drawing's shape
 *  so it is never stretched. */
export function otherSide(aspect: number, side: number, typed: "w" | "h"): number {
  const v = typed === "w" ? side / aspect : side * aspect;
  return Math.min(PASTED_SVG_MAX_SIDE, Math.max(1, Math.round(v)));
}

function num(v: number): string {
  const r = Number(v.toPrecision(6));
  return Object.is(r, -0) ? "0" : String(r);
}

/**
 * The SVG to import: the paste with its root tag sized to `width`×`height`, the
 * namespaces an `<img>` needs, and an optional solid background.
 * `background` is r/g/b (0–255) or null for transparent. Numbers in, so no
 * user string ever lands in an attribute.
 */
export function buildPastedSvg(
  svg: Extract<PastedSvg, { kind: "ok" }>,
  width: number,
  height: number,
  background: { r: number; g: number; b: number } | null,
): string {
  const { text, frame } = svg;
  const root = findRootSvgTag(text)!;
  let tag = text.slice(root.start, root.end);
  if (!root.attrs.has("xmlns")) tag = setAttr(tag, "xmlns", "http://www.w3.org/2000/svg");
  if (/\sxlink:/.test(text) && !root.attrs.has("xmlns:xlink")) {
    tag = setAttr(tag, "xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
  // A size-only SVG gets the viewBox its size implied, so the drawing scales
  // to the new canvas instead of sitting at its old size in a corner.
  if (frame && !root.attrs.has("viewBox")) {
    tag = setAttr(tag, "viewBox", `${num(frame.x)} ${num(frame.y)} ${num(frame.w)} ${num(frame.h)}`);
  }
  tag = setAttr(tag, "width", String(Math.round(width)));
  tag = setAttr(tag, "height", String(Math.round(height)));

  let under = "";
  if (background) {
    const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    const fill = `#${hex(background.r)}${hex(background.g)}${hex(background.b)}`;
    under = frame
      ? `<rect x="${num(frame.x)}" y="${num(frame.y)}" width="${num(frame.w)}" height="${num(frame.h)}" fill="${fill}"/>`
      : `<rect width="100%" height="100%" fill="${fill}"/>`;
  }
  return text.slice(0, root.start) + tag + under + text.slice(root.end);
}
