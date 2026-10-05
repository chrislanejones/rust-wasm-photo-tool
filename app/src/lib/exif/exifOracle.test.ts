// app/src/lib/exif/exifOracle.test.ts — the TS EXIF code is the ORACLE for the
// Rust port in `src/exif.rs`. Every (fixture, operation) row must come out byte
// for byte identical on both sides.
//
// Three checks, one row set (tests/fixtures/exif/manifest.tsv):
//   1. GOLDEN  — the TS oracle, run on each committed input, reproduces the
//                committed output exactly. Pins the oracle: a TS change that
//                alters output goes red here until the goldens are regenerated
//                ON PURPOSE (IH_WRITE_EXIF_GOLDENS=1 pnpm -C app test exifOracle).
//   2. ENGINE  — the BUILT wasm (pkg/stamp_tool_bg.wasm, loaded with initSync)
//                produces the same bytes as the TS oracle and the golden. This
//                is the shipped artifact, not a native build of the source.
//   3. (Rust)  — tests/exif_oracle.rs runs the same rows through the same
//                exports natively, so `cargo test` catches drift without node.
//
// Inputs are COMMITTED, not rebuilt each run, so nothing environmental can move
// them. The builders below only run when regenerating.
//
// The Rust export path is NOT wired into the app: both implementations run side
// by side behind this test. Flipping the export path is an attended decision.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { applyExifToReencoded, applyExifToVerbatim, readExifTiff, stripMetadata } from "@/lib/exif";
import type { ExportFormat } from "@/lib/exportImage";

type Bytes = Uint8Array<ArrayBuffer>;

const REPO = path.resolve(__dirname, "../../../..");
const DIR = path.join(REPO, "tests/fixtures/exif");
const MANIFEST = path.join(DIR, "manifest.tsv");
const WASM = path.join(REPO, "pkg/stamp_tool_bg.wasm");
const WRITE = process.env.IH_WRITE_EXIF_GOLDENS === "1";

// Every row the manifest must carry. A shrunk manifest would pass vacuously, so
// the count is pinned here and in tests/exif_oracle.rs.
const EXPECTED_ROWS = 281;

// ── Operations (one name per row; both sides dispatch on the same name) ────

const OPS = [
  "read",
  "strip_all",
  "strip_location",
  "verbatim_keep",
  "verbatim_strip_all",
  "verbatim_strip_location",
  "reencoded_keep_a",
  "reencoded_keep_b",
  "reencoded_keep_null",
  "reencoded_strip_a",
] as const;
type Op = (typeof OPS)[number] | "reencoded_keep_big";

interface Row {
  fixture: string;
  op: Op;
  mime: string;
  format: ExportFormat;
  width: number;
  height: number;
  tiff: string; // "-" = null source tiff
  expected: string; // "null" = the operation returns null
}

function sourceTiffName(op: Op): string {
  if (op === "reencoded_keep_a" || op === "reencoded_strip_a") return "source_a.tiff";
  if (op === "reencoded_keep_b") return "source_b.tiff";
  if (op === "reencoded_keep_big") return "source_big.tiff";
  return "-";
}

function runOracle(row: Row, input: Bytes, tiff: Bytes | null): Bytes | null {
  switch (row.op) {
    case "read":
      return readExifTiff(input, row.mime);
    case "strip_all":
      return stripMetadata(input, "all");
    case "strip_location":
      return stripMetadata(input, "location");
    case "verbatim_keep":
      return applyExifToVerbatim(input, row.mime, "keep");
    case "verbatim_strip_all":
      return applyExifToVerbatim(input, row.mime, "strip", "all");
    case "verbatim_strip_location":
      return applyExifToVerbatim(input, row.mime, "strip", "location");
    case "reencoded_strip_a":
      return applyExifToReencoded(input, row.format, "strip", tiff, row.width, row.height);
    default:
      return applyExifToReencoded(input, row.format, "keep", tiff, row.width, row.height);
  }
}

interface ExifWasm {
  initSync(opts: { module: BufferSource }): unknown;
  exif_read_tiff(bytes: Uint8Array, mime: string): Uint8Array | undefined;
  exif_strip_metadata(bytes: Uint8Array, mode: string): Uint8Array;
  exif_apply_verbatim(bytes: Uint8Array, mime: string, mode: string, stripMode: string): Uint8Array;
  exif_apply_reencoded(
    encoded: Uint8Array,
    format: string,
    mode: string,
    sourceTiff: Uint8Array | undefined,
    width: number,
    height: number,
  ): Uint8Array;
}

function runEngine(w: ExifWasm, row: Row, input: Bytes, tiff: Bytes | null): Uint8Array | null {
  switch (row.op) {
    case "read":
      return w.exif_read_tiff(input, row.mime) ?? null;
    case "strip_all":
      return w.exif_strip_metadata(input, "all");
    case "strip_location":
      return w.exif_strip_metadata(input, "location");
    case "verbatim_keep":
      return w.exif_apply_verbatim(input, row.mime, "keep", "all");
    case "verbatim_strip_all":
      return w.exif_apply_verbatim(input, row.mime, "strip", "all");
    case "verbatim_strip_location":
      return w.exif_apply_verbatim(input, row.mime, "strip", "location");
    case "reencoded_strip_a":
      return w.exif_apply_reencoded(input, row.format, "strip", tiff ?? undefined, row.width, row.height);
    default:
      return w.exif_apply_reencoded(input, row.format, "keep", tiff ?? undefined, row.width, row.height);
  }
}

/** "" when equal, else the first differing offset and both bytes. */
function byteDiff(expected: Uint8Array | null, actual: Uint8Array | null): string {
  if (expected === null || actual === null) {
    return expected === actual ? "" : `expected ${expected ? "bytes" : "null"}, got ${actual ? "bytes" : "null"}`;
  }
  const n = Math.min(expected.length, actual.length);
  for (let i = 0; i < n; i++) {
    if (expected[i] !== actual[i]) {
      return `offset ${i}: expected 0x${expected[i].toString(16)}, actual 0x${actual[i].toString(16)} (len ${expected.length} vs ${actual.length})`;
    }
  }
  return expected.length === actual.length ? "" : `length ${expected.length} vs ${actual.length} (equal prefix)`;
}

// ── Fixture builders (only run when regenerating) ───────────────────────────

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

interface Ent {
  tag: number;
  type: number;
  count: number;
  data: number[];
}

/** One TIFF with IFD0 → (Exif IFD, GPS IFD). `le` picks II vs MM. */
function tiff(opts: { le: boolean; gpsType?: number; gpsPtrOverride?: number; pad?: number }): Bytes {
  const { le } = opts;
  const out: number[] = [];
  const u16 = (v: number) => (le ? [v & 0xff, (v >> 8) & 0xff] : [(v >> 8) & 0xff, v & 0xff]);
  const u32 = (v: number) =>
    le
      ? [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]
      : [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
  const str = (s: string) => [...ascii(s), 0];
  const rat = (pairs: number[][]) => pairs.flatMap(([n, d]) => [...u32(n), ...u32(d)]);

  // Layout an IFD at `base`, returning its bytes (fixed part + external data).
  const ifd = (base: number, ents: Ent[]): number[] => {
    const fixed = 2 + ents.length * 12 + 4;
    const body: number[] = [...u16(ents.length)];
    const ext: number[] = [];
    for (const e of ents) {
      body.push(...u16(e.tag), ...u16(e.type), ...u32(e.count));
      if (e.data.length <= 4) body.push(...e.data, ...new Array(4 - e.data.length).fill(0));
      else {
        body.push(...u32(base + fixed + ext.length));
        ext.push(...e.data);
      }
    }
    body.push(...u32(0));
    return [...body, ...ext];
  };

  const gpsEnts: Ent[] = [
    { tag: 0x0001, type: 2, count: 2, data: str("N") },
    { tag: 0x0002, type: 5, count: 3, data: rat([[37, 1], [46, 1], [3050, 100]]) },
    { tag: 0x0003, type: 2, count: 2, data: str("W") },
    { tag: 0x0004, type: 5, count: 3, data: rat([[122, 1], [25, 1], [10, 1]]) },
    { tag: 0x0006, type: 5, count: 1, data: rat([[12, 1]]) },
  ];
  const exifEnts: Ent[] = [
    { tag: 0x829a, type: 5, count: 1, data: rat([[1, 250]]) },
    { tag: 0x829d, type: 5, count: 1, data: rat([[28, 10]]) },
    { tag: 0x8827, type: 3, count: 1, data: u16(400) },
    { tag: 0x9003, type: 2, count: 20, data: str("2026:09:25 01:02:03") },
    { tag: 0xa434, type: 2, count: 11, data: str("50mm f/1.8") },
  ];
  const mkIfd0 = (exifOff: number, gpsOff: number): Ent[] => [
    { tag: 0x010f, type: 2, count: 8, data: str("TestCam") },
    { tag: 0x0110, type: 2, count: 8, data: str("Model X") },
    { tag: 0x0112, type: 3, count: 1, data: u16(1) },
    { tag: 0x8769, type: 4, count: 1, data: u32(exifOff) },
    { tag: 0x8825, type: opts.gpsType ?? 4, count: 1, data: u32(opts.gpsPtrOverride ?? gpsOff) },
  ];
  const ifd0Len = ifd(8, mkIfd0(0, 0)).length;
  const gpsOff = 8 + ifd0Len;
  const gpsLen = ifd(gpsOff, gpsEnts).length;
  const exifOff = gpsOff + gpsLen;
  out.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  out.push(...ifd(8, mkIfd0(exifOff, gpsOff)));
  out.push(...ifd(gpsOff, gpsEnts));
  out.push(...ifd(exifOff, exifEnts));
  for (let i = 0; i < (opts.pad ?? 0); i++) out.push((i * 7) & 0xff);
  return new Uint8Array(out);
}

const seg = (marker: number, payload: number[] | Uint8Array): number[] => {
  const len = payload.length + 2;
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload];
};
const scan = (seed: number, n = 48) => Array.from({ length: n }, (_, i) => (seed * 31 + i * 17) & 0xff);
const jpegExifPayload = (t: Uint8Array) => [...ascii("Exif"), 0, 0, ...t];

function crc32(bytes: number[]): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
const be32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
const le32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
const pngChunk = (type: string, data: number[] | Uint8Array) => {
  const td = [...ascii(type), ...data];
  return [...be32(data.length), ...td, ...be32(crc32(td))];
};
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const IHDR = [...be32(2), ...be32(2), 8, 2, 0, 0, 0];
const riff = (chunks: number[][]) => {
  const body = [...ascii("WEBP"), ...chunks.flat()];
  return [...ascii("RIFF"), ...le32(body.length), ...body];
};
const wchunk = (fourcc: string, data: number[] | Uint8Array) => {
  const d = Array.from(data);
  return [...ascii(fourcc), ...le32(d.length), ...d, ...(d.length & 1 ? [0] : [])];
};

interface Fixture {
  name: string;
  mime: string;
  format: ExportFormat;
  width: number;
  height: number;
  bytes: number[];
}

function buildFixtures(): Fixture[] {
  const tLe = tiff({ le: true });
  const tBe = tiff({ le: false });
  const J = (name: string, bytes: number[], w = 2, h = 2): Fixture => ({ name, mime: "image/jpeg", format: "jpeg", width: w, height: h, bytes });
  const P = (name: string, bytes: number[]): Fixture => ({ name, mime: "image/png", format: "png", width: 2, height: 2, bytes });
  const W = (name: string, bytes: number[], w = 2, h = 2): Fixture => ({ name, mime: "image/webp", format: "webp", width: w, height: h, bytes });
  const sosEoi = (seed: number) => [0xff, 0xda, 0x00, 0x02, ...scan(seed), 0xff, 0xd9];
  const idat = pngChunk("IDAT", [0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01]);
  const vp8l = (alpha: boolean) => [0x2f, 0x01, 0x40, 0x00, alpha ? 0x10 : 0x00, 0x11, 0x22];

  return [
    // JPEG
    J("jpeg_exif", [0xff, 0xd8, ...seg(0xe1, jpegExifPayload(tLe)), ...seg(0xed, ascii("Photoshop 3.0\0IPTC")), ...sosEoi(7)]),
    J("jpeg_plain", [0xff, 0xd8, ...seg(0xe0, ascii("JFIF\0\x01\x01\0\0\x01\0\x01\0\0")), ...sosEoi(3)]),
    J(
      "jpeg_mixed_be",
      [
        0xff, 0xd8,
        ...seg(0xe0, ascii("JFIF\0\x01\x02")),
        ...seg(0xe1, ascii("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>")),
        ...seg(0xe2, ascii("ICC_PROFILE\0\x01\x01fakeprofile")),
        ...seg(0xe1, jpegExifPayload(tBe)),
        0xff, 0xd0, // stray RST0 — walked over, kept
        ...seg(0xdb, scan(11, 65)),
        ...seg(0xed, ascii("8BIM")),
        ...sosEoi(9),
      ],
      3000,
      2000,
    ),
    J("jpeg_truncated_segment", [0xff, 0xd8, ...seg(0xe0, ascii("JFIF\0")), 0xff, 0xe1, 0x40, 0x00, ...ascii("Exif\0\0II*\0")]),
    J("jpeg_no_sos_trailing", [0xff, 0xd8, ...seg(0xe1, jpegExifPayload(tLe)), ...seg(0xdb, scan(2, 10)), 0x01, 0x02, 0x03]),
    J("jpeg_short_app1", [0xff, 0xd8, ...seg(0xe1, [0x45, 0x78]), ...ascii("if\0\0"), ...sosEoi(1)]),
    J("jpeg_eoi_then_garbage", [0xff, 0xd8, ...seg(0xe1, jpegExifPayload(tLe)), 0xff, 0xd9, 0xaa, 0xbb, 0xcc, 0xdd, 0xee]),
    J("jpeg_non_marker", [0xff, 0xd8, ...seg(0xed, ascii("IPTC")), 0x12, 0x34, 0x56, 0x78, 0x9a]),
    J("jpeg_gps_short_type", [0xff, 0xd8, ...seg(0xe1, jpegExifPayload(tiff({ le: true, gpsType: 3 }))), ...sosEoi(5)]),
    J("jpeg_gps_ptr_oob", [0xff, 0xd8, ...seg(0xe1, jpegExifPayload(tiff({ le: true, gpsPtrOverride: 0x7fff0000 }))), ...sosEoi(6)]),
    J("jpeg_exif_be_padded", [0xff, 0xd8, ...seg(0xe1, jpegExifPayload(tiff({ le: false, pad: 3 }))), ...sosEoi(8)]),
    // PNG
    P("png_exif", [...PNG_SIG, ...pngChunk("IHDR", IHDR), ...pngChunk("eXIf", tLe), ...pngChunk("tEXt", ascii("Comment\0hello")), ...idat, ...pngChunk("IEND", [])]),
    P("png_plain", [...PNG_SIG, ...pngChunk("IHDR", IHDR), ...idat, ...pngChunk("IEND", [])]),
    P(
      "png_all_meta_be",
      [
        ...PNG_SIG,
        ...pngChunk("IHDR", IHDR),
        ...pngChunk("iCCP", ascii("sRGB\0\0fake")),
        ...pngChunk("tIME", [0x07, 0xea, 9, 25, 1, 2, 3]),
        ...pngChunk("zTXt", ascii("Author\0\0xx")),
        ...pngChunk("iTXt", ascii("XML:com.adobe.xmp\0\0\0\0\0<x/>")),
        ...pngChunk("eXIf", tBe),
        ...idat,
        ...pngChunk("IEND", []),
        0xde, 0xad, 0xbe, 0xef, // trailing garbage after IEND
      ],
    ),
    P("png_truncated", [...PNG_SIG, ...pngChunk("IHDR", IHDR), ...pngChunk("tEXt", ascii("a\0b")), ...be32(9999), ...ascii("IDAT"), 1, 2, 3]),
    P("png_exif_gps_oob", [...PNG_SIG, ...pngChunk("IHDR", IHDR), ...pngChunk("eXIf", tiff({ le: true, gpsPtrOverride: 60000 })), ...idat, ...pngChunk("IEND", [])]),
    // WebP
    W("webp_vp8l_exif", riff([wchunk("VP8L", vp8l(false)), wchunk("EXIF", tLe)])),
    W("webp_vp8l_plain", riff([wchunk("VP8L", vp8l(false))])),
    W("webp_vp8l_alpha", riff([wchunk("VP8L", vp8l(true))]), 640, 480),
    W("webp_vp8_plain", riff([wchunk("VP8 ", scan(4, 13))]), 17, 9),
    W(
      "webp_vp8x_full",
      riff([
        wchunk("VP8X", [0x3c, 0, 0, 0, 1, 0, 0, 1, 0, 0]),
        wchunk("ICCP", ascii("fakeicc")),
        wchunk("ALPH", scan(5, 9)),
        wchunk("VP8 ", scan(6, 20)),
        wchunk("EXIF", tiff({ le: false, pad: 1 })),
        wchunk("XMP ", ascii("<x:xmpmeta/>")),
      ]),
      2,
      2,
    ),
    W("webp_vp8x_empty", riff([wchunk("VP8X", []), wchunk("VP8L", vp8l(false))])),
    W("webp_no_bitstream", riff([wchunk("ICCP", ascii("abcd"))])),
    W("webp_truncated", [...riff([wchunk("VP8L", vp8l(false))]).slice(0, 12), ...ascii("VP8L"), ...le32(500), 1, 2, 3, 4, 5, 6]),
    W("webp_trailing_short", [...riff([wchunk("VP8L", vp8l(true)), wchunk("EXIF", tLe)]), 0x41, 0x42, 0x43]),
    W("webp_zero_size", riff([wchunk("VP8L", vp8l(false))]), 0, 5),
    // Not an image — every operation passes it through (AVIF / unknown gap).
    { name: "not_image", mime: "image/avif", format: "avif", width: 2, height: 2, bytes: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  ];
}

function sourceTiffs(): Record<string, Bytes> {
  const big = new Uint8Array(0xffff - 8 + 1); // one byte past the JPEG APP1 limit
  big.set(tiff({ le: true }), 0);
  return {
    "source_a.tiff": tiff({ le: true }), // 325 B, odd → WebP pad byte
    "source_b.tiff": tiff({ le: false, pad: 1 }), // 326 B, even, big-endian
    "source_big.tiff": big,
  };
}

function writeGoldens(): number {
  fs.mkdirSync(DIR, { recursive: true });
  const tiffs = sourceTiffs();
  for (const [name, b] of Object.entries(tiffs)) fs.writeFileSync(path.join(DIR, name), b);
  const lines = ["# fixture\top\tmime\tformat\twidth\theight\tsource_tiff\texpected  (generated by exifOracle.test.ts)"];
  for (const f of buildFixtures()) {
    const input = new Uint8Array(f.bytes);
    fs.writeFileSync(path.join(DIR, `${f.name}.in.bin`), input);
    const ops: Op[] = [...OPS];
    if (f.format === "jpeg") ops.push("reencoded_keep_big");
    for (const op of ops) {
      const t = sourceTiffName(op);
      const row: Row = { fixture: f.name, op, mime: f.mime, format: f.format, width: f.width, height: f.height, tiff: t, expected: "" };
      const out = runOracle(row, input, t === "-" ? null : tiffs[t]);
      row.expected = out === null ? "null" : `${f.name}.${op}.bin`;
      if (out !== null) fs.writeFileSync(path.join(DIR, row.expected), out);
      lines.push([row.fixture, row.op, row.mime, row.format, row.width, row.height, row.tiff, row.expected].join("\t"));
    }
  }
  fs.writeFileSync(MANIFEST, lines.join("\n") + "\n");
  return lines.length - 1;
}

// ── Reading the committed set ──────────────────────────────────────────────

function readBytes(name: string): Bytes {
  return new Uint8Array(fs.readFileSync(path.join(DIR, name)));
}

function loadRows(): Row[] {
  return fs
    .readFileSync(MANIFEST, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [fixture, op, mime, format, width, height, tiffName, expected] = l.split("\t");
      return { fixture, op: op as Op, mime, format: format as ExportFormat, width: Number(width), height: Number(height), tiff: tiffName, expected };
    });
}

function inputsFor(row: Row) {
  return {
    input: readBytes(`${row.fixture}.in.bin`),
    tiff: row.tiff === "-" ? null : readBytes(row.tiff),
    golden: row.expected === "null" ? null : readBytes(row.expected),
  };
}

describe("exif oracle — committed goldens", () => {
  if (WRITE) {
    it("regenerates the goldens from the TS oracle", () => {
      expect(writeGoldens()).toBe(EXPECTED_ROWS);
    });
  }

  it(`the manifest carries all ${EXPECTED_ROWS} rows`, () => {
    expect(loadRows()).toHaveLength(EXPECTED_ROWS);
  });

  it("the TS oracle reproduces every golden byte for byte", () => {
    const bad: string[] = [];
    for (const row of loadRows()) {
      const { input, tiff: t, golden } = inputsFor(row);
      const d = byteDiff(golden, runOracle(row, input, t));
      if (d) bad.push(`${row.fixture} × ${row.op}: ${d}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("exif oracle — the built engine (pkg/stamp_tool_bg.wasm)", () => {
  it("every row: wasm output === TS oracle output === golden", async () => {
    if (!fs.existsSync(WASM)) {
      throw new Error("pkg/stamp_tool_bg.wasm is missing — run `pnpm run build:wasm` first.");
    }
    const w = (await import("stamp_tool")) as unknown as ExifWasm;
    w.initSync({ module: fs.readFileSync(WASM) });
    if (typeof w.exif_strip_metadata !== "function") {
      throw new Error("pkg/ has no exif_* exports — it predates src/exif.rs; run `pnpm run build:wasm`.");
    }
    const rows = loadRows();
    expect(rows).toHaveLength(EXPECTED_ROWS);
    const bad: string[] = [];
    for (const row of rows) {
      const { input, tiff: t, golden } = inputsFor(row);
      const oracle = runOracle(row, input, t);
      const engine = runEngine(w, row, input, t);
      const d1 = byteDiff(oracle, engine);
      const d2 = byteDiff(golden, engine);
      if (d1) bad.push(`${row.fixture} × ${row.op} (vs oracle): ${d1}`);
      if (d2) bad.push(`${row.fixture} × ${row.op} (vs golden): ${d2}`);
    }
    expect(bad).toEqual([]);
  });
});
