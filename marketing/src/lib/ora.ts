/* OpenRaster (.ora) in the browser: read one, draw one, make one.
 *
 * A .ora is a ZIP: `mimetype` (stored, first), `stack.xml`, one PNG per
 * layer, `mergedimage.png` and a thumbnail. The viewer on /openraster reads it
 * here, in the tab, with nothing sent anywhere — the same promise the editor
 * makes, so the page cannot be the one exception.
 *
 * NO WASM ON PURPOSE. The editor decodes layer PNGs with the engine's own
 * `png` crate so that import and export share a codec. That is the right call
 * for an editor and the wrong one for a viewer: measured on 8 layers of
 * 3000×2000 (60 MB of PNG), the browser's own decoder run in parallel took
 * 377 ms, the wasm decoder 1,977 ms — and the wasm is 354 KB gzipped before it
 * decodes a byte. `createImageBitmap` is multi-threaded and already installed.
 *
 * Everything that touches a canvas, DOMParser or a blob URL lives behind a
 * function call. The prerender imports this module under Node and never calls
 * one.
 */

/** OpenRaster composite-op → the canvas 2D name. Unknown ops draw as normal. */
export const OPS: Record<string, GlobalCompositeOperation> = {
  "svg:src-over": "source-over",
  "svg:multiply": "multiply",
  "svg:screen": "screen",
  "svg:overlay": "overlay",
  "svg:darken": "darken",
  "svg:lighten": "lighten",
  "svg:color-dodge": "color-dodge",
  "svg:color-burn": "color-burn",
  "svg:hard-light": "hard-light",
  "svg:soft-light": "soft-light",
  "svg:difference": "difference",
  "svg:exclusion": "exclusion",
  "svg:hue": "hue",
  "svg:saturation": "saturation",
  "svg:color": "color",
  "svg:luminosity": "luminosity",
  "svg:plus": "lighter",
  "svg:dst-in": "destination-in",
  "svg:dst-out": "destination-out",
  "svg:src-atop": "source-atop",
  "svg:dst-atop": "destination-atop",
};

export const kb = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;

/* ── ZIP ──────────────────────────────────────────────────────────────────
 * A .ora needs two of ZIP's features: stored entries and deflated entries.
 * That is small enough to read by hand, and the writer below only ever stores
 * (a PNG is already compressed; deflating it again buys nothing).
 */

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** Write a stored (uncompressed) ZIP. `mimetype` must be passed first: the
 *  OpenRaster spec wants it as the first entry so a reader can sniff it. */
/** TS 5.7 types a bare `Uint8Array` over `ArrayBufferLike`, which a Blob will
 *  not take; every byte array here is backed by a plain ArrayBuffer. */
type Bytes = Uint8Array<ArrayBuffer>;

export function writeZip(files: { name: string; data: Bytes }[], type: string): Blob {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const cen: Bytes[] = [];
  let off = 0;
  for (const f of files) {
    const n = enc.encode(f.name);
    const crc = crc32(f.data);
    const len = f.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, len, true);
    h.setUint32(22, len, true);
    h.setUint16(26, n.length, true);
    parts.push(h.buffer, n, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, len, true);
    c.setUint32(24, len, true);
    c.setUint16(28, n.length, true);
    c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), n);
    off += 30 + n.length + len;
  }
  const size = cen.reduce((s, a) => s + a.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, size, true);
  e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, e.buffer], { type });
}

interface ZipEntry {
  name: string;
  method: number;
  comp: number;
  /** Local header offset — the archive order, which is what "first" means. */
  lo: number;
  start: number;
}

function readZip(buf: ArrayBuffer) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  // The end-of-central-directory record is at the tail, behind a comment of
  // up to 64 KB. Scan back for its signature.
  let eo = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eo = i;
      break;
    }
  }
  if (eo < 0) throw new Error("This isn't a ZIP archive, so it can't be a .ora file.");
  const count = dv.getUint16(eo + 10, true);
  let p = dv.getUint32(eo + 16, true);
  const dec = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.byteLength || dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const comp = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true);
    const el = dv.getUint16(p + 30, true);
    const cl = dv.getUint16(p + 32, true);
    const lo = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    entries.push({ name, method, comp, lo, start });
    p += 46 + nl + el + cl;
  }
  const byName = new Map(entries.map((e) => [e.name, e]));
  const read = async (name: string): Promise<Bytes | null> => {
    const e = byName.get(name);
    if (!e) return null;
    const raw = u8.subarray(e.start, e.start + e.comp);
    if (e.method === 0) return raw.slice();
    if (e.method === 8) {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    throw new Error(`${name} uses a compression method this viewer can't read.`);
  };
  return { entries, has: (n: string) => byName.has(n), read };
}

/* ── the document ─────────────────────────────────────────────────────── */

export interface OraLayer {
  name: string;
  src: string;
  x: number;
  y: number;
  opacity: number;
  /** The product of every enclosing stack's opacity. */
  group: number;
  visible: boolean;
  op: string;
  selected: boolean;
  depth: number;
  bmp?: ImageBitmap;
  /** Object URL of the layer's own PNG bytes — the thumbnail and the download. */
  url?: string;
  bytes?: number;
}

export interface OraCheck {
  label: string;
  ok: boolean;
}

export interface OraDoc {
  fileName: string;
  size: number;
  w: number;
  h: number;
  /** Top layer first, as stack.xml lists them. */
  layers: OraLayer[];
  merged: { bmp: ImageBitmap; url: string } | null;
  version: string;
  warnings: string[];
  checks: OraCheck[];
}

const num = (v: string | null, d: number) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : d;
};

const list = (a: string[]) =>
  a.length > 3 ? `${a.slice(0, 3).join(", ")} and ${a.length - 3} more` : a.join(", ");

/** Read a .ora. Every layer PNG is decoded at once — the browser's decoder is
 *  threaded, and one big file is where the difference is felt. */
export async function parseOra(buf: ArrayBuffer, fileName: string, size: number): Promise<OraDoc> {
  const z = readZip(buf);
  const dec = new TextDecoder();
  const first = [...z.entries].sort((a, b) => a.lo - b.lo)[0];

  const mtBytes = await z.read("mimetype");
  const mt = mtBytes ? dec.decode(mtBytes).trim() : null;
  if (mt !== "image/openraster") {
    throw new Error(
      mt ? `Not a .ora file — its mimetype says "${mt}".` : "Not a .ora file — there's no mimetype entry inside.",
    );
  }
  const xb = await z.read("stack.xml");
  if (!xb) throw new Error("Not a valid .ora file — stack.xml is missing.");
  const xml = new DOMParser().parseFromString(dec.decode(xb), "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("stack.xml couldn't be read — the XML is malformed.");
  const image = xml.documentElement;
  const w = num(image.getAttribute("w"), 0);
  const h = num(image.getAttribute("h"), 0);

  const layers: OraLayer[] = [];
  let nested = false;
  const walk = (el: Element, alpha: number, vis: boolean, depth: number) => {
    for (const c of Array.from(el.children)) {
      if (c.localName === "stack") {
        nested = true;
        walk(c, alpha * num(c.getAttribute("opacity"), 1), vis && c.getAttribute("visibility") !== "hidden", depth + 1);
      } else if (c.localName === "layer") {
        layers.push({
          name: c.getAttribute("name") || "Untitled",
          src: c.getAttribute("src") || "",
          x: num(c.getAttribute("x"), 0),
          y: num(c.getAttribute("y"), 0),
          opacity: Math.min(1, Math.max(0, num(c.getAttribute("opacity"), 1))),
          group: alpha,
          visible: vis && c.getAttribute("visibility") !== "hidden",
          op: c.getAttribute("composite-op") || "svg:src-over",
          selected: c.getAttribute("selected") === "true" || c.getAttribute("imagehorse:active") === "true",
          depth,
        });
      }
    }
  };
  const root = Array.from(image.children).find((c) => c.localName === "stack");
  if (root) walk(root, 1, true, 0);
  if (!layers.length) throw new Error("This .ora file's stack.xml lists no layers.");

  const missing: string[] = [];
  await Promise.all(
    layers.map(async (l) => {
      const bytes = l.src ? await z.read(l.src) : null;
      if (!bytes) {
        missing.push(l.name);
        return;
      }
      const blob = new Blob([bytes], { type: "image/png" });
      l.bmp = await createImageBitmap(blob);
      l.url = URL.createObjectURL(blob);
      l.bytes = bytes.length;
    }),
  );
  const offset = layers.filter((l) => l.bmp && (l.x || l.y)).map((l) => l.name);
  const odd = layers
    .filter((l) => l.bmp && !(l.x || l.y) && w && (l.bmp.width !== w || l.bmp.height !== h))
    .map((l) => l.name);

  const mb = await z.read("mergedimage.png");
  let merged: OraDoc["merged"] = null;
  if (mb) {
    const blob = new Blob([mb], { type: "image/png" });
    merged = { bmp: await createImageBitmap(blob), url: URL.createObjectURL(blob) };
  }
  const firstBmp = layers.find((l) => l.bmp)?.bmp;
  const cw = w || firstBmp?.width || merged?.bmp.width || 1;
  const ch = h || firstBmp?.height || merged?.bmp.height || 1;

  // What the editor's importer does with each of these is in
  // app/src/lib/openraster/import.ts; the warnings say so rather than guess.
  const warnings: string[] = [];
  if (offset.length) {
    warnings.push(
      `${offset.length === 1 ? "One layer is" : `${offset.length} layers are`} placed at an offset (${list(offset)}). Image Horse's importer puts every layer at the top-left today, so these may come in blank.`,
    );
  }
  if (odd.length) {
    warnings.push(`${list(odd)} ${odd.length === 1 ? "isn't" : "aren't"} the size of the canvas. Import expects full-size layers.`);
  }
  if (nested) warnings.push("This file has layer groups. They're shown flattened here, and Image Horse imports them as a flat stack.");
  if (layers.some((l) => l.op !== "svg:src-over")) {
    warnings.push("Some layers use a blend mode. It's drawn here, but Image Horse imports every layer as normal.");
  }
  if (missing.length) warnings.push(`stack.xml names ${list(missing)}, but the PNG isn't in the archive.`);

  const version = image.getAttribute("version") || "unstated";
  const checks: OraCheck[] = [
    { label: "mimetype is image/openraster", ok: true },
    { label: "mimetype is first and uncompressed", ok: first?.name === "mimetype" && first?.method === 0 },
    { label: `stack.xml, version ${version}`, ok: true },
    { label: merged ? "mergedimage.png" : "No mergedimage.png", ok: !!merged },
    { label: z.has("Thumbnails/thumbnail.png") ? "Thumbnails/thumbnail.png" : "No thumbnail", ok: z.has("Thumbnails/thumbnail.png") },
  ];
  return { fileName, size, w: cw, h: ch, layers, merged, version, warnings, checks };
}

/** Let go of every bitmap and blob URL a document holds. */
export function releaseOra(doc: OraDoc | null) {
  if (!doc) return;
  for (const l of doc.layers) {
    l.bmp?.close();
    if (l.url) URL.revokeObjectURL(l.url);
  }
  if (doc.merged) {
    doc.merged.bmp.close();
    URL.revokeObjectURL(doc.merged.url);
  }
}

/** Draw the document into a canvas: the layer stack, or the file's own
 *  flattened copy. Bottom layer first, as a painter would. */
export function drawOra(c: HTMLCanvasElement, d: OraDoc, view: "composite" | "merged") {
  if (c.width !== d.w) c.width = d.w;
  if (c.height !== d.h) c.height = d.h;
  const g = c.getContext("2d");
  if (!g) return;
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, d.w, d.h);
  if (view === "merged" && d.merged) {
    g.drawImage(d.merged.bmp, 0, 0, d.w, d.h);
    return;
  }
  for (let i = d.layers.length - 1; i >= 0; i--) {
    const l = d.layers[i];
    if (!l.visible || !l.bmp) continue;
    g.globalAlpha = l.opacity * l.group;
    g.globalCompositeOperation = OPS[l.op] ?? "source-over";
    g.drawImage(l.bmp, l.x, l.y);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}

/* ── the sample ───────────────────────────────────────────────────────── */

const toPng = (c: HTMLCanvasElement) =>
  new Promise<Bytes>((resolve, reject) =>
    c.toBlob((b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a))) : reject(new Error("toBlob failed"))), "image/png"),
  );

/** A five-layer .ora drawn on the spot — a sunset, because it needs a blend
 *  mode, an offset layer and a hidden one to exercise every column of the
 *  viewer. Made here rather than shipped as a file: 600 KB of PNG is a real
 *  download, and a few gradients are not. */
export async function makeSample(): Promise<Blob> {
  const W = 720;
  const H = 450;
  const mk = (w: number, h: number, fn: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    fn(c.getContext("2d")!);
    return c;
  };
  const bg = mk(W, H, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#241510");
    gr.addColorStop(0.7, "#7a3b1d");
    gr.addColorStop(1, "#b5622a");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  });
  const glow = mk(W, H, (g) => {
    const gr = g.createRadialGradient(470, 250, 20, 470, 250, 300);
    gr.addColorStop(0, "#ffb45a");
    gr.addColorStop(1, "rgba(255,120,40,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  });
  const sun = mk(W, H, (g) => {
    g.fillStyle = "#f5a445";
    g.beginPath();
    g.arc(470, 262, 82, 0, Math.PI * 2);
    g.fill();
  });
  const hills = mk(W, H, (g) => {
    g.fillStyle = "#3a1d12";
    g.beginPath();
    g.moveTo(0, 300);
    g.bezierCurveTo(160, 230, 300, 330, 470, 290);
    g.bezierCurveTo(580, 265, 660, 300, W, 280);
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.fill();
    g.fillStyle = "#1c0f0a";
    g.beginPath();
    g.moveTo(0, 360);
    g.bezierCurveTo(200, 320, 380, 400, 560, 350);
    g.bezierCurveTo(630, 332, 690, 345, W, 340);
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.fill();
  });
  const cap = mk(300, 56, (g) => {
    g.fillStyle = "rgba(20,12,9,0.72)";
    g.beginPath();
    g.roundRect(0, 0, 300, 56, 12);
    g.fill();
    g.fillStyle = "#f3e7da";
    g.font = "600 22px Geist, system-ui, sans-serif";
    g.textBaseline = "middle";
    g.fillText("sample.ora · 5 layers", 18, 29);
  });
  const stack = [
    { name: "Caption", c: cap, x: 32, y: 32, opacity: 1, vis: false, op: "svg:src-over", selected: false },
    { name: "Hills", c: hills, x: 0, y: 0, opacity: 1, vis: true, op: "svg:src-over", selected: true },
    { name: "Sun", c: sun, x: 0, y: 0, opacity: 0.95, vis: true, op: "svg:src-over", selected: false },
    { name: "Glow", c: glow, x: 0, y: 0, opacity: 0.6, vis: true, op: "svg:screen", selected: false },
    { name: "Background", c: bg, x: 0, y: 0, opacity: 1, vis: true, op: "svg:src-over", selected: false },
  ];
  const merged = mk(W, H, (g) => {
    for (const l of [...stack].reverse()) {
      if (!l.vis) continue;
      g.globalAlpha = l.opacity;
      g.globalCompositeOperation = OPS[l.op];
      g.drawImage(l.c, l.x, l.y);
    }
  });
  const thumb = mk(256, 160, (g) => g.drawImage(merged, 0, 0, 256, 160));
  const n = stack.length;
  const xml =
    `<?xml version='1.0' encoding='UTF-8'?>\n<image w="${W}" h="${H}" version="0.0.3">\n  <stack>\n` +
    stack
      .map(
        (l, i) =>
          `    <layer name="${l.name}" src="data/layer${n - 1 - i}.png" x="${l.x}" y="${l.y}" opacity="${l.opacity}" visibility="${l.vis ? "visible" : "hidden"}" composite-op="${l.op}"${l.selected ? ' selected="true"' : ""}/>`,
      )
      .join("\n") +
    `\n  </stack>\n</image>\n`;
  const enc = new TextEncoder();
  const files = [
    { name: "mimetype", data: enc.encode("image/openraster") },
    { name: "stack.xml", data: enc.encode(xml) },
  ];
  for (let i = n - 1; i >= 0; i--) files.push({ name: `data/layer${n - 1 - i}.png`, data: await toPng(stack[i].c) });
  files.push({ name: "mergedimage.png", data: await toPng(merged) });
  files.push({ name: "Thumbnails/thumbnail.png", data: await toPng(thumb) });
  return writeZip(files, "image/openraster");
}
