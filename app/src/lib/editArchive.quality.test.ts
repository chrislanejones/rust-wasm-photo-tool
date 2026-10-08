import { expect, it } from 'vitest';
import { encodeArchive, decodeArchive } from './editArchive';
import { decodeCapture } from './editPersistence';
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
it('archive v6 round-trips different current, undo and redo quality values', () => {
  const encoded = encodeArchive(8, 4, png, [{ label: 'Compress', png, exportQuality: 90 }], [{ label: 'Compress', png, exportQuality: 35 }], '[]', '[]', [], 0, 60);
  const saved = decodeArchive(encoded);
  expect(saved.exportQuality).toBe(60);
  expect(saved.undoStack[0].exportQuality).toBe(90);
  expect(saved.redoStack[0].exportQuality).toBe(35);
  expect(saved.canvasPng).toEqual(png);
});
it('v5 archives remain readable without inventing saved quality', () => {
  const newer = encodeArchive(8, 4, png, [], [], '[]', '[]', [], 0, 60);
  const older = newer.slice(0, -4);
  new DataView(older.buffer).setUint32(4, 5, true);
  const saved = decodeArchive(older);
  expect(saved.exportQuality).toBeUndefined();
  expect(saved.canvasW).toBe(8);
});
it('truncated v6 quality metadata fails rather than reporting a restored setting', () => {
  const blob = encodeArchive(8, 4, png, [], [], '[]', '[]', [], 0, 60);
  expect(() => decodeArchive(blob.slice(0, -2))).toThrow();
});
it('capture version 1 is accepted; version 2 carries the quality footer', () => {
  const data: number[] = [];
  const u32 = (n: number) => { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n, true); data.push(...a); };
  const str = (s: string) => { const bytes = new TextEncoder().encode(s); u32(bytes.length); data.push(...bytes); };
  u32(0x49484353); u32(1); u32(8); u32(4); u32(png.length); data.push(...png);
  u32(0); u32(0); str('[]'); str('[]'); str('[]'); u32(0); u32(0);
  const v1 = new Uint8Array(data);
  expect(decodeCapture(v1).exportQuality).toBeUndefined();
  new DataView(v1.buffer).setUint32(4, 2, true);
  u32(61);
  const v2 = new Uint8Array(data); new DataView(v2.buffer).setUint32(4, 2, true);
  expect(decodeCapture(v2).exportQuality).toBe(61);
});
