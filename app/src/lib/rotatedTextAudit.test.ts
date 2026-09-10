// The audit's job is to produce ONE number Chris will act on ("migrate if it is
// anything but zero"). So the failure that matters is not an off-by-one — it is
// the audit reporting 0 for a reason that is not "there are none".

import { describe, it, expect, beforeEach } from "vitest";
import { auditRotatedText, formatRotatedTextMarkdown } from "./rotatedTextAudit";

const DB_NAME = "image-horse-edits";
const STORE = "edits";

async function seed(records: Record<string, unknown>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE, "readwrite");
      for (const [k, v] of Object.entries(records)) tx.objectStore(STORE).put(v, k);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

async function wipe(): Promise<void> {
  for (const d of await indexedDB.databases()) {
    if (d.name) {
      await new Promise((r) => {
        const req = indexedDB.deleteDatabase(d.name!);
        req.onsuccess = r;
        req.onerror = r;
        req.onblocked = r;
      });
    }
  }
}

const ann = (over: Record<string, unknown> = {}) => ({
  id: 1,
  text: "hello world",
  x: 10,
  y: 10,
  font_size: 24,
  r: 0,
  g: 0,
  b: 0,
  bold: false,
  rotation_deg: 0,
  ...over,
});

beforeEach(wipe);

describe("auditRotatedText — 'nothing read' must not read as 'zero'", () => {
  // THE failure this test file exists for. A count of 0 from a missing database
  // is indistinguishable from a real 0 unless the report says so, and the
  // decision riding on it is "any non-zero means migrate".
  it("reports dbFound:false, not a clean zero, when no archive exists", async () => {
    const r = await auditRotatedText();
    expect(r.dbFound).toBe(false);
    expect(r.rotated).toBe(0);
    expect(r.notes.length).toBeGreaterThan(0);
    const md = formatRotatedTextMarkdown(r);
    expect(md).toMatch(/NOT a count of zero/i);
    // And it must NOT render the "migration not needed" verdict off a
    // database it never opened.
    expect(md).not.toMatch(/Migration not needed/i);
  });

  it("does not CREATE the database it was asked to audit", async () => {
    await auditRotatedText();
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain(DB_NAME);
  });
});

describe("auditRotatedText — counting", () => {
  it("counts rotated annotations and leaves unrotated ones out", async () => {
    await seed({
      photoA: { annotations: [ann({ rotation_deg: 30 }), ann({ rotation_deg: 0 })] },
    });
    const r = await auditRotatedText();
    expect(r.dbFound).toBe(true);
    expect(r.textAnnotations).toBe(2);
    expect(r.rotated).toBe(1);
  });

  it("uses the engine's own 0.5 deg threshold, not != 0", async () => {
    // build_annotation_tile takes the no-rotation early return below 0.5, so a
    // 0.2 deg annotation is not rotated in any sense that moves pixels.
    await seed({ photoA: { annotations: [ann({ rotation_deg: 0.2 })] } });
    expect((await auditRotatedText()).rotated).toBe(0);
    await wipe();
    await seed({ photoB: { annotations: [ann({ rotation_deg: 0.9 })] } });
    expect((await auditRotatedText()).rotated).toBe(1);
  });

  it("counts annotations nested inside layers (archive v5+)", async () => {
    // Counting only the top-level array would undercount every multi-layer
    // document — and multi-layer is the shape this app produces by default.
    await seed({
      photoA: {
        annotations: [],
        layers: [{ annotations: [ann({ rotation_deg: 15 })] }, { annotations: [ann()] }],
      },
    });
    const r = await auditRotatedText();
    expect(r.textAnnotations).toBe(2);
    expect(r.rotated).toBe(1);
  });

  it("estimated shift grows with text length, which is the whole bug", async () => {
    await seed({
      short: { annotations: [ann({ text: "AAA", rotation_deg: 30 })] },
      long: { annotations: [ann({ text: "A".repeat(60), rotation_deg: 30 })] },
    });
    const r = await auditRotatedText();
    const [biggest, smallest] = [r.rows[0], r.rows[r.rows.length - 1]];
    expect(biggest.estShiftPx).toBeGreaterThan(smallest.estShiftPx);
  });

  it("survives junk in the store instead of throwing mid-count", async () => {
    // Real archives predate several field additions; a probe that dies on one
    // malformed record reports nothing about the other 200.
    await seed({
      good: { annotations: [ann({ rotation_deg: 20 })] },
      junk: { annotations: [{ nope: true }, null] },
      alsoJunk: { annotations: "not-an-array", layers: 7 },
    });
    const r = await auditRotatedText();
    expect(r.dbFound).toBe(true);
    expect(r.rotated).toBe(1);
  });
});
