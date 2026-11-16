// Builds the Find duplicates fixtures (ticket 232). Drawn scenes, never real
// photos. Run once and commit the outputs:
//   node e2e/fixtures/dupes/make-fixtures.mjs
//
// Three scenes, drawn on a canvas in Chromium with seeded noise so they weigh
// and behave like photos:
//
//   lake    one photo, five ways:
//             lake-960.jpg     the "camera original", 960 x 720
//             lake-640.jpg     the same photo exported at 640 x 480
//             lake-320.jpg     ...and at 320 x 240
//             lake-resave.jpg  lake-960.jpg decoded and saved again at q 0.55
//             lake-crop.jpg    lake-960.jpg with 1 px cropped off the left
//   beach   a burst: two frames 1/10 s apart. The walker moves 12 px, the
//           exposure drifts 2 levels, the sensor noise is fresh.
//             beach-burst-1.jpg, beach-burst-2.jpg
//   pier    two DIFFERENT photos of the same place: a wide shot, and a
//           closer one after a step to the right (camera panned 30%, zoomed
//           1.4x). These must stay apart.
//             pier-wide.jpg, pier-close.jpg
//
// thumbs/*.png are what the gallery would store for each file: the app's own
// thumbnail recipe (lib/workingCopy.ts makeThumbnail: long edge 256,
// createImageBitmap "medium", WebP q 0.78), decoded and written as PNG so the
// vitest suite can read them with the engine's PNG decoder (node has no WebP
// or JPEG decoder). The Rust hash runs on exactly those pixels.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, "thumbs"), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><title>fixtures</title>");

const out = await page.evaluate(async () => {
  /** Seeded xorshift, so every run draws the same noise. */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 1000) / 1000;
    };
  }

  /** Draw a scene into a w x h canvas. The scene lives in a 1 x 0.75 world;
   *  `cam` picks the window onto it (x, y offset and zoom). */
  function draw(kind, w, h, { cam = { x: 0, y: 0, zoom: 1 }, seed = 1, walker = 0, exposure = 0 } = {}) {
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext("2d");
    const s = w * cam.zoom; // world unit -> px
    ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    const r = rng(seed * 7919);
    if (kind === "lake") {
      let g = ctx.createLinearGradient(0, 0, 0, 0.45);
      g.addColorStop(0, "#6f9fd8");
      g.addColorStop(1, "#d8e6f2");
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 3, 1.5);
      ctx.fillStyle = "#fff4c2";
      ctx.beginPath();
      ctx.arc(0.78, 0.12, 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5b6b7d";
      ctx.beginPath();
      ctx.moveTo(-0.1, 0.45);
      [0.08, 0.22, 0.31, 0.47, 0.58, 0.72, 0.86, 1.1].forEach((x, i) => ctx.lineTo(x, i % 2 ? 0.3 : 0.18 + 0.04 * i));
      ctx.lineTo(1.1, 0.45);
      ctx.fill();
      g = ctx.createLinearGradient(0, 0.45, 0, 0.75);
      g.addColorStop(0, "#3d6e8f");
      g.addColorStop(1, "#1e3a4f");
      ctx.fillStyle = g;
      ctx.fillRect(-1, 0.45, 3, 1);
      ctx.fillStyle = "#2f4f2a";
      for (let i = 0; i < 9; i++) {
        const x = 0.03 + i * 0.11;
        ctx.beginPath();
        ctx.moveTo(x, 0.47);
        ctx.lineTo(x + 0.035, 0.33 + (i % 3) * 0.02);
        ctx.lineTo(x + 0.07, 0.47);
        ctx.fill();
      }
    } else if (kind === "beach") {
      let g = ctx.createLinearGradient(0, 0, 0, 0.35);
      g.addColorStop(0, "#4b8fd1");
      g.addColorStop(1, "#bcdcf0");
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 3, 1.36);
      ctx.fillStyle = "#2a7bab";
      ctx.fillRect(-1, 0.35, 3, 0.15);
      ctx.fillStyle = "#e8f4f8";
      ctx.fillRect(-1, 0.495, 3, 0.012);
      ctx.fillStyle = "#e3c99a";
      ctx.fillRect(-1, 0.5, 3, 1);
      ctx.fillStyle = "#d24a3a";
      ctx.beginPath();
      ctx.arc(0.25, 0.52, 0.09, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#6b4a2b";
      ctx.fillRect(0.247, 0.52, 0.006, 0.14);
      const x = 0.6 + walker;
      ctx.fillStyle = "#22313f";
      ctx.fillRect(x, 0.5, 0.03, 0.12);
      ctx.beginPath();
      ctx.arc(x + 0.015, 0.48, 0.017, 0, Math.PI * 2);
      ctx.fill();
    } else {
      let g = ctx.createLinearGradient(0, 0, 0, 0.5);
      g.addColorStop(0, "#f2a65a");
      g.addColorStop(1, "#f7d9a8");
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 3, 1.5);
      ctx.fillStyle = "#355c7d";
      ctx.fillRect(-1, 0.5, 3, 1);
      ctx.fillStyle = "#4a3b33";
      ctx.fillRect(0.15, 0.47, 0.9, 0.025);
      for (let i = 0; i < 12; i++) ctx.fillRect(0.17 + i * 0.075, 0.49, 0.008, 0.12);
      ctx.fillStyle = "#6c5b7b";
      [
        [0.02, 0.3, 0.08, 0.2],
        [0.11, 0.24, 0.06, 0.26],
        [0.82, 0.33, 0.1, 0.17],
      ].forEach(([bx, by, bw, bh]) => ctx.fillRect(bx, by, bw, bh));
      ctx.fillStyle = "#fffbe6";
      ctx.beginPath();
      ctx.arc(0.55, 0.42, 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Sensor noise + exposure drift.
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 18 + exposure;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  async function jpeg(canvas, q) {
    return new Uint8Array(await (await canvas.convertToBlob({ type: "image/jpeg", quality: q })).arrayBuffer());
  }
  async function decode(bytes) {
    return createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
  }
  function scaled(src, w, h) {
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, w, h);
    return c;
  }

  const files = {};
  const lake = draw("lake", 960, 720, { seed: 1 });
  files["lake-960.jpg"] = await jpeg(lake, 0.9);
  files["lake-640.jpg"] = await jpeg(scaled(lake, 640, 480), 0.9);
  files["lake-320.jpg"] = await jpeg(scaled(lake, 320, 240), 0.9);
  const lakeBmp = await decode(files["lake-960.jpg"]);
  files["lake-resave.jpg"] = await jpeg(scaled(lakeBmp, 960, 720), 0.55);
  const crop = new OffscreenCanvas(959, 720);
  crop.getContext("2d").drawImage(lakeBmp, 1, 0, 959, 720, 0, 0, 959, 720);
  files["lake-crop.jpg"] = await jpeg(crop, 0.9);
  files["beach-burst-1.jpg"] = await jpeg(draw("beach", 960, 720, { seed: 2 }), 0.9);
  files["beach-burst-2.jpg"] = await jpeg(draw("beach", 960, 720, { seed: 3, walker: 12 / 960, exposure: 2 }), 0.9);
  files["pier-wide.jpg"] = await jpeg(draw("pier", 960, 720, { seed: 4 }), 0.9);
  files["pier-close.jpg"] = await jpeg(draw("pier", 960, 720, { seed: 5, cam: { x: 0.3, y: 0.12, zoom: 1.4 } }), 0.9);

  // The gallery's thumbnail recipe, then decoded to PNG for node.
  const thumbs = {};
  for (const [name, bytes] of Object.entries(files)) {
    const blob = new Blob([bytes], { type: "image/jpeg" });
    const probe = await createImageBitmap(blob);
    const long = Math.max(probe.width, probe.height);
    const k = long > 256 ? 256 / long : 1;
    const tw = Math.round(probe.width * k);
    const th = Math.round(probe.height * k);
    probe.close();
    const bmp = await createImageBitmap(blob, { resizeWidth: tw, resizeHeight: th, resizeQuality: "medium" });
    const oc = new OffscreenCanvas(bmp.width, bmp.height);
    oc.getContext("2d").drawImage(bmp, 0, 0);
    const webp = await oc.convertToBlob({ type: "image/webp", quality: 0.78 });
    const back = await createImageBitmap(webp);
    const pc = new OffscreenCanvas(back.width, back.height);
    pc.getContext("2d").drawImage(back, 0, 0);
    thumbs[name.replace(/\.jpg$/, ".png")] = new Uint8Array(await (await pc.convertToBlob({ type: "image/png" })).arrayBuffer());
  }
  const b64 = (u8) => {
    let bin = "";
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  return {
    files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, b64(v)])),
    thumbs: Object.fromEntries(Object.entries(thumbs).map(([k, v]) => [k, b64(v)])),
  };
});

for (const [name, data] of Object.entries(out.files)) writeFileSync(join(here, name), Buffer.from(data, "base64"));
for (const [name, data] of Object.entries(out.thumbs)) writeFileSync(join(here, "thumbs", name), Buffer.from(data, "base64"));
await browser.close();
console.log(`wrote ${Object.keys(out.files).length} photos and ${Object.keys(out.thumbs).length} thumbnails to ${here}`);
