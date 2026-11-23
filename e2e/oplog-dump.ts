import type { Page, TestInfo } from "@playwright/test";
import { writeFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// Op-log + undo-stack dump for chasing callout-leader §4 (11-22-2026).
//
// OFF unless `E2E_OPLOG_DUMP=1`. e2e code never ships to production, and with
// the flag unset every call below returns at once, so a normal run is unchanged.
//
// One dump = what the live engine holds (op log: length, cursor, generation,
// health, the last 10 ops by variant and id, with the SameGesture markers;
// undo snapshot stack: count, labels, text ids of the top 3) AND what is on disk
// for the next resume (the op-log manifest + chunk and keyframe rows in
// `image-horse-dexie`, the archive record in `image-horse-edits`). The engine
// has no accessor for a SNAPSHOT's shapes, so the top-3 entries carry text ids
// only; shapes come from the archive record (live list) and the op frames.
// ─────────────────────────────────────────────────────────────────────────────

export const OPLOG_DUMP = process.env.E2E_OPLOG_DUMP === "1";

/** Op variant index → name (src/ops.rs `Op`, postcard index after the version
 *  byte; the order is pinned by ops.rs `variant_indices_are_stable`). */
const OP_NAMES = [
  "Stroke", "FillRegion", "Blur", "Levels", "Crop", "TextAdd", "TextEdit", "TextRemove",
  "ShapeAdd", "ShapeRemove", "LayerMove", "ShapeEdit", "TextWrap", "TextBoxHeight",
  "TextPerspective", "PerspectiveWarp", "ShapePerspective", "ShapeSloppiness", "TextFont",
  "ShapeRotation", "ShapeStarPoints", "ShapeCornerRadii", "SameGesture", "TonalStack",
  "Adjustments", "TextStroke", "TextAlign",
];

/** Collect the page's op-log / persistence console lines from here on. */
export function watchPersistConsole(page: Page): string[] {
  const lines: string[] = [];
  if (!OPLOG_DUMP) return lines;
  const t0 = Date.now();
  page.on("console", (m) => {
    const s = m.text();
    if (/oplog|op log|archive|working copy|persist|restore|save|refus/i.test(s)) {
      lines.push(`+${Date.now() - t0}ms ${m.type()}: ${s.slice(0, 400)}`);
    }
  });
  return lines;
}

export async function dumpOplogState(page: Page, testInfo: TestInfo, tag: string): Promise<unknown> {
  if (!OPLOG_DUMP) return null;
  const dump = await page.evaluate(async (names) => {
    const t = window.__annotationTool as unknown as Record<string, (...a: unknown[]) => unknown>;
    const call = async (fn: string, ...a: unknown[]) => {
      try {
        return typeof t?.[fn] === "function" ? await t[fn](...a) : "(no export)";
      } catch (e) {
        return `(threw ${String(e)})`;
      }
    };
    const varint = (b: Uint8Array, at: number): [number, number] => {
      let v = 0, shift = 0, i = at;
      for (; i < b.length; i++) {
        v += (b[i] & 0x7f) * 2 ** shift;
        shift += 7;
        if ((b[i] & 0x80) === 0) return [v, i + 1];
      }
      return [v, i];
    };
    // Variants whose first field is a u32 id (src/ops.rs).
    const ID_FIRST = new Set([5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 25, 26]);
    const decodeFrames = (bytes: Uint8Array, firstIndex: number) => {
      const out: { i: number; op: string; id?: number; kind?: number; len: number }[] = [];
      let at = 0, i = firstIndex;
      while (at + 4 <= bytes.length) {
        const len = bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24);
        const f = bytes.subarray(at + 4, at + 4 + len);
        at += 4 + len;
        const [variant, next] = varint(f, 1);
        const row: { i: number; op: string; id?: number; kind?: number; len: number } = {
          i, op: names[variant] ?? `#${variant}`, len,
        };
        if (ID_FIRST.has(variant)) {
          const [id, after] = varint(f, next);
          row.id = id;
          if (variant === 8 || variant === 11) row.kind = f[after]; // ShapeParams.kind
        }
        out.push(row);
        i++;
      }
      return out;
    };

    const engine: Record<string, unknown> = {};
    const opCount = Number(await call("oplog_op_count"));
    engine.opCount = opCount;
    engine.cursor = await call("oplog_cursor");
    engine.generation = await call("oplog_generation");
    engine.status = await call("oplog_status");
    engine.broken = await call("oplog_is_broken");
    engine.active = await call("oplog_active");
    engine.editRevision = await call("oplog_edit_revision");
    engine.keyframes = Array.from((await call("oplog_mem_keyframe_ops")) as ArrayLike<number> ?? []);
    engine.undoCount = await call("undo_count");
    engine.redoCount = await call("redo_count");
    engine.historyLabels = await call("history_labels");
    if (opCount > 0) {
      const from = Math.max(0, opCount - 10);
      const frames = (await call("oplog_encoded_ops", from, opCount)) as Uint8Array;
      engine.lastOps = frames instanceof Uint8Array || ArrayBuffer.isView(frames)
        ? decodeFrames(new Uint8Array(frames as Uint8Array), from) : frames;
    }
    const snaps = Number(await call("undo_snapshot_count"));
    engine.undoSnapshots = snaps;
    engine.redoSnapshots = await call("redo_snapshot_count");
    engine.undoTop3 = [];
    for (let i = snaps - 1; i >= Math.max(0, snaps - 3); i--) {
      const texts = JSON.parse(String(await call("get_undo_snapshot_annotations", i))) as { id: number; text?: string; x: number; y: number }[];
      (engine.undoTop3 as unknown[]).push({
        index: i,
        label: await call("get_undo_snapshot_label", i),
        texts: texts.map((x) => ({ id: x.id, text: x.text, x: x.x, y: x.y })),
      });
    }
    const shapes = JSON.parse(String(await call("get_shape_annotations"))) as { id: number; kind: number; x0: number; y0: number; x1: number; y1: number }[];
    const texts = JSON.parse(String(await call("get_text_annotations"))) as { id: number; text: string; x: number; y: number }[];
    engine.live = {
      shapes: shapes.map((s) => ({ id: s.id, kind: s.kind, x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 })),
      texts: texts.map((x) => ({ id: x.id, text: x.text, x: x.x, y: x.y })),
    };

    // ── Disk ──────────────────────────────────────────────────────────────
    // ⚠️ Only a database that ALREADY exists is opened. `indexedDB.open(name)`
    // with no version CREATES a missing one, empty, at version 1, and the app's
    // own `open(name, 1)` then gets no upgrade and no object store: the first
    // run of this dump did exactly that to `image-horse-edits` (the archive is
    // written later than the op log) and every autosave failed after it.
    const existing = new Set((await indexedDB.databases()).map((d) => d.name));
    const openDb = (name: string) =>
      new Promise<IDBDatabase | null>((res, rej) => {
        if (!existing.has(name)) return res(null);
        const r = indexedDB.open(name);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    const all = (db: IDBDatabase, store: string) =>
      new Promise<{ key: IDBValidKey; value: unknown }[]>((res, rej) => {
        if (!db.objectStoreNames.contains(store)) return res([]);
        const out: { key: IDBValidKey; value: unknown }[] = [];
        const c = db.transaction(store, "readonly").objectStore(store).openCursor();
        c.onsuccess = () => {
          const cur = c.result;
          if (!cur) return res(out);
          out.push({ key: cur.key, value: cur.value });
          cur.continue();
        };
        c.onerror = () => rej(c.error);
      });
    const disk: Record<string, unknown> = {};
    try {
      const dx = await openDb("image-horse-dexie");
      if (!dx) throw new Error("not created yet");
      disk.manifests = (await all(dx, "oplogManifests")).map((r) => r.value);
      disk.chunks = await Promise.all((await all(dx, "opLogs")).map(async (r) => {
        const v = r.value as { photoId: string; chunkSeq: number; opCount: number; bytes: Uint8Array; createdAt: number };
        // The newest chunk's ops, decoded the same way (start index unknown here).
        return { photoId: v.photoId, chunkSeq: v.chunkSeq, opCount: v.opCount, bytes: v.bytes.length, createdAt: v.createdAt, ops: decodeFrames(v.bytes, 0).map((o) => o.id === undefined ? o.op : `${o.op}(${o.id}${o.kind !== undefined ? `,k${o.kind}` : ""})`) };
      }));
      disk.keyframes = (await all(dx, "keyframes")).map((r) => {
        const v = r.value as { atOp: number; createdAt: number };
        return { atOp: v.atOp, createdAt: v.createdAt };
      });
      dx.close();
    } catch (e) {
      disk.dexieError = String(e);
    }
    try {
      const ed = await openDb("image-horse-edits");
      if (!ed) throw new Error("not created yet");
      disk.archive = (await all(ed, "edits")).map(({ key, value }) => {
        const v = value as {
          undoStack?: { label: string; annotations?: { id: number; text: string; x: number; y: number }[] }[];
          redoStack?: { label: string }[];
          annotations?: { id: number; text: string; x: number; y: number }[];
          shapes?: { kind: number; x0: number; y0: number; x1: number; y1: number }[];
          layers?: { id: number; annotations?: unknown[]; shapes?: unknown[] }[];
          savedAt?: number; updatedAt?: number;
        };
        return {
          key,
          undo: (v.undoStack ?? []).map((s) => ({ label: s.label, texts: (s.annotations ?? []).map((a) => `${a.id}:${a.text}@${a.x},${a.y}`) })),
          redo: (v.redoStack ?? []).map((s) => s.label),
          texts: (v.annotations ?? []).map((a) => `${a.id}:${a.text}@${a.x},${a.y}`),
          shapes: (v.shapes ?? []).map((s) => `k${s.kind} ${s.x0},${s.y0}→${s.x1},${s.y1}`),
          layers: (v.layers ?? []).map((l) => ({ id: l.id, texts: l.annotations?.length ?? 0, shapes: l.shapes?.length ?? 0 })),
        };
      });
      ed.close();
    } catch (e) {
      disk.archiveError = String(e);
    }
    const trace = (window as unknown as { __engineTrace?: string[] }).__engineTrace ?? [];
    return { at: performance.now(), engine, disk, trace: trace.slice(-250) };
  }, OP_NAMES);
  const body = JSON.stringify({ tag, ...(dump as object) }, null, 1);
  // A file in the test's own output folder, so a PASSING run's dump survives
  // too (body attachments only reach disk through the HTML report).
  const file = testInfo.outputPath(`oplog-${tag}.json`);
  writeFileSync(file, body);
  await testInfo.attach(`oplog-${tag}.json`, { path: file, contentType: "application/json" });
  return dump;
}

/** Record, in order, every engine call the page posts to the engine worker and
 *  every key press, without calling the engine (so the timing it watches is not
 *  moved). The worker drains its port strictly FIFO (engine.worker.ts `drain`),
 *  so post order IS execution order. Survives reloads (init script); each page
 *  load starts a fresh buffer. Read by `dumpOplogState`. */
export async function installEngineTrace(page: Page): Promise<void> {
  if (!OPLOG_DUMP) return;
  await page.addInitScript(() => {
    const w = window as unknown as { __engineTrace: string[] };
    w.__engineTrace = [];
    const t0 = performance.now();
    const push = (s: string) => {
      w.__engineTrace.push(`${(performance.now() - t0).toFixed(0)} ${s}`);
      if (w.__engineTrace.length > 600) w.__engineTrace.splice(0, 100);
    };
    const brief = (a: unknown): string =>
      typeof a === "number" ? String(Math.round(a * 100) / 100)
        : typeof a === "string" ? JSON.stringify(a.slice(0, 12))
          : ArrayBuffer.isView(a) ? `[${Array.from(a as unknown as ArrayLike<number>).slice(0, 6).join(",")}]`
            : typeof a === "boolean" ? String(a) : typeof a;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, msg: unknown, ...rest: unknown[]) {
      const m = msg as { kind?: string; method?: string; args?: unknown[] } | null;
      if (m?.kind === "call") push(`${m.method}(${(m.args ?? []).map(brief).join(",")})`);
      else if (m?.kind === "blit") push("·blit");
      return (post as (...a: unknown[]) => void).call(this, msg, ...rest);
    } as typeof Worker.prototype.postMessage;
    window.addEventListener("keydown", (e) => {
      push(`KEY ${e.ctrlKey ? "Ctrl+" : ""}${e.shiftKey ? "Shift+" : ""}${e.key}`);
    }, true);
  });
}
