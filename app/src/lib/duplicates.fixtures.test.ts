// Find duplicates on real thumbnails through the BUILT engine (ticket 232).
//
// e2e/fixtures/dupes/thumbs/*.png are the gallery thumbnails of the fixture
// photos, made with the app's own recipe (see make-fixtures.mjs there). Each
// one goes through `photo_fingerprint` in pkg/stamp_tool_bg.wasm — the same
// call the dialog makes — and then through lib/duplicates.ts. This is where
// LOOKS_SAME_BITS was tuned: the distance table below is printed on every run.
// Distances are the closest of the 8 turns and flips (`lookAlikeDistance`).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  COLOR_LIMIT,
  colorDistance,
  groupLookAlikes,
  hashDistance,
  lookAlikeDistance,
  LOOKS_SAME_BITS,
  LOOKS_SAME_TURNED_BITS,
  turnedDistance,
  type Fingerprint,
} from "./duplicates";
import { toFingerprint } from "@/features/gallery/photoFingerprints";

const REPO = path.resolve(__dirname, "../../..");
const WASM = path.join(REPO, "pkg/stamp_tool_bg.wasm");
const THUMBS = path.join(REPO, "e2e/fixtures/dupes/thumbs");

interface Engine {
  initSync(opts: { module: BufferSource }): unknown;
  decode_png_to_rgba(png: Uint8Array): { width: number; height: number; rgba: Uint8Array; free(): void };
  photo_fingerprint(px: Uint8Array, w: number, h: number): Uint32Array;
}

// lake-rot90 (a quarter turn) and lake-mirror (left to right) joined 11-23-2026:
// the hash is matched in all 8 turns and flips, so a turned copy is the same photo.
const STRAIGHT = ["lake-960", "lake-640", "lake-320", "lake-resave", "lake-crop"];
const TURNED = ["lake-rot90", "lake-mirror"];
const SAME_PHOTO = [...STRAIGHT, ...TURNED];
const BURST = ["beach-burst-1", "beach-burst-2"];
const SAME_SCENE = ["pier-wide", "pier-close"];
const ALL = [...SAME_PHOTO, ...BURST, ...SAME_SCENE];
/** The nine fixtures from before turns were matched (11-15-2026). */
const BEFORE = [...STRAIGHT, ...BURST, ...SAME_SCENE];

async function fingerprints(): Promise<Map<string, Fingerprint>> {
  if (!fs.existsSync(WASM)) throw new Error("pkg/stamp_tool_bg.wasm is missing — run `pnpm run build:wasm` first.");
  const w = (await import("stamp_tool")) as unknown as Engine;
  w.initSync({ module: fs.readFileSync(WASM) });
  if (typeof w.photo_fingerprint !== "function") {
    throw new Error("pkg/ has no photo_fingerprint — it predates src/dhash.rs; run `pnpm run build:wasm`.");
  }
  const out = new Map<string, Fingerprint>();
  for (const name of ALL) {
    const png = w.decode_png_to_rgba(new Uint8Array(fs.readFileSync(path.join(THUMBS, `${name}.png`))));
    const { width, height, rgba } = png;
    png.free();
    const fp = toFingerprint(w.photo_fingerprint(rgba, width, height));
    if (!fp) throw new Error(`no fingerprint for ${name}`);
    out.set(name, fp);
  }
  return out;
}

describe("Find duplicates — fixtures through the built engine", () => {
  it("groups the same photo and the burst, keeps the two pier shots apart", async () => {
    const fps = await fingerprints();

    // The table the threshold was chosen from: bits / worst color channel.
    const rows = ALL.map((a) => `${a.padEnd(14)} ${ALL.map((b) => `${lookAlikeDistance(fps.get(a)!, fps.get(b)!)}/${colorDistance(fps.get(a)!, fps.get(b)!)}`.padStart(6)).join("")}`);
    console.info(
      `dHash distance, closest orientation (bits/color), threshold ${LOOKS_SAME_BITS} straight, ${LOOKS_SAME_TURNED_BITS} turned, color ${COLOR_LIMIT}\n${rows.join("\n")}`,
    );

    const groups = groupLookAlikes(ALL.map((id) => ({ id, fp: fps.get(id)! })));
    expect(groups).toEqual([SAME_PHOTO, BURST]);

    // And with room on both sides of the threshold: measured 11-15-2026,
    // same-photo pairs 0–2 bits, different-photo pairs 10–21 (straight hash,
    // the nine fixtures from before turns were matched).
    const isSame = (a: string, b: string) =>
      (SAME_PHOTO.includes(a) && SAME_PHOTO.includes(b)) || (BURST.includes(a) && BURST.includes(b));
    const pairs = (ids: string[]) => ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b] as const));
    const d = (a: string, b: string) => hashDistance(fps.get(a)!, fps.get(b)!);
    const same = pairs(BEFORE).filter(([a, b]) => isSame(a, b)).map(([a, b]) => d(a, b));
    const cross = pairs(BEFORE).filter(([a, b]) => !isSame(a, b)).map(([a, b]) => d(a, b));
    console.info(`straight: same-photo pairs max ${Math.max(...same)} bits; different-photo pairs min ${Math.min(...cross)} bits`);
    expect(Math.max(...same)).toBeLessThanOrEqual(LOOKS_SAME_BITS - 2);
    expect(Math.min(...cross)).toBeGreaterThanOrEqual(LOOKS_SAME_BITS + 4);

    // Through a turn or a flip (11-23-2026): the turned copies are 0–1 bits
    // from the rest of the lake; different photos in their closest
    // orientation are 8 or more, so the tighter turned limit keeps room.
    const t = (a: string, b: string) => turnedDistance(fps.get(a)!, fps.get(b)!);
    const turnedSame = TURNED.flatMap((a) => SAME_PHOTO.filter((b) => b !== a).map((b) => t(a, b)));
    const turnedCross = pairs(ALL).filter(([a, b]) => !isSame(a, b)).map(([a, b]) => t(a, b));
    const straightOfTurned = TURNED.map((a) => d(a, "lake-960"));
    console.info(
      `turned: copies max ${Math.max(...turnedSame)} bits (straight hash ${straightOfTurned.join(", ")} bits from lake-960); different photos min ${Math.min(...turnedCross)} bits`,
    );
    expect(Math.min(...straightOfTurned)).toBeGreaterThan(LOOKS_SAME_BITS); // the straight hash alone misses them
    expect(Math.max(...turnedSame)).toBeLessThanOrEqual(LOOKS_SAME_TURNED_BITS - 2);
    expect(Math.min(...turnedCross)).toBeGreaterThanOrEqual(LOOKS_SAME_TURNED_BITS + 3);
  });

  it("fingerprints and groups 200 thumbnails in under a second (engine hash, cold)", async () => {
    const w = (await import("stamp_tool")) as unknown as Engine;
    w.initSync({ module: fs.readFileSync(WASM) });
    // 200 decoded 256 x 192 thumbnails: the nine fixtures, repeated.
    const decoded = ALL.map((name) => {
      const png = w.decode_png_to_rgba(new Uint8Array(fs.readFileSync(path.join(THUMBS, `${name}.png`))));
      const d = { width: png.width, height: png.height, rgba: png.rgba };
      png.free();
      return d;
    });
    const t0 = performance.now();
    const items = Array.from({ length: 200 }, (_, i) => {
      const d = decoded[i % decoded.length]!;
      return { id: `p${i}`, fp: toFingerprint(w.photo_fingerprint(d.rgba, d.width, d.height))! };
    });
    const t1 = performance.now();
    const groups = groupLookAlikes(items);
    const t2 = performance.now();
    console.info(`200 photos: hash ${(t1 - t0).toFixed(1)} ms + group ${(t2 - t1).toFixed(1)} ms`);
    expect(groups.length).toBeGreaterThan(0);
    expect(t2 - t0).toBeLessThan(1000);
  });
});
