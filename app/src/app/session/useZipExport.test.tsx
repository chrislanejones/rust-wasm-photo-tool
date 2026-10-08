// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useZipExport } from "./useZipExport";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), loading: vi.fn(), error: vi.fn(), success: vi.fn(), file: vi.fn() }));
vi.mock("jszip", () => ({ default: class { file = mocks.file; generateAsync = mocks.generate; } }));
vi.mock("@/components/ui/sonner", () => ({ toast: { loading: mocks.loading, error: mocks.error, success: mocks.success, dismiss: vi.fn() } }));
vi.mock("@/lib/dexie/originalsAdapter", () => ({ getOriginal: async () => ({ bytes: new Uint8Array([1]), mimeType: "image/png" }) }));
vi.mock("@/lib/batchExportPlan", () => ({ resolveExportSource: async () => ({ source: "original" }) }));
vi.mock("@/lib/zipEntry", () => ({ untouchedZipEntry: async () => ({ bytes: new Uint8Array([1]), mime: "image/png", ext: ".png" }) }));

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function setup() {
  const deps = { activePhotoId: null, activeChanged: false, toolRef: { current: null }, exportFormat: "png", quality: 75, canvasBgTransparent: false, exportCanvasBackground: "include", exifKeep: false, exifStripMode: "all", loadPhotoEdit: vi.fn(), savePhotoEdit: vi.fn() };
  const hook = renderHook(() => useZipExport(deps as unknown as Parameters<typeof useZipExport>[0]));
  const photos = [{ id: "a", name: "photo", originalKey: "original" }] as Parameters<typeof hook.result.current.exportZip>[0];
  return { ...hook, photos };
}

it("a timed-out packaging result neither downloads nor replaces its failure", async () => {
  let resolve!: (blob: Blob) => void;
  mocks.generate.mockImplementation(() => new Promise<Blob>(r => { resolve = r; }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const h = setup();
  let pending!: Promise<void>;
  await act(async () => { pending = h.result.current.exportZip(h.photos, "photos.zip"); });
  await act(async () => { await vi.advanceTimersByTimeAsync(600_001); await pending; });
  expect(h.result.current.state).toBe("error");
  await act(async () => { resolve(new Blob(["zip"])); });
  expect(click).not.toHaveBeenCalled();
  expect(mocks.success).not.toHaveBeenCalled();
  expect(h.result.current.state).toBe("error");
  expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("timed out"), expect.objectContaining({ duration: Infinity }));
});

it("double submission packages and downloads once, with measured packaging progress", async () => {
  let resolve!: (blob: Blob) => void;
  mocks.generate.mockImplementation((_opts, progress) => { progress({ percent: 40 }); return new Promise<Blob>(r => { resolve = r; }); });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const h = setup();
  let first!: Promise<void>;
  await act(async () => { first = h.result.current.exportZip(h.photos, "photos.zip"); await h.result.current.exportZip(h.photos, "photos.zip"); });
  expect(mocks.generate).toHaveBeenCalledOnce();
  expect(mocks.loading).toHaveBeenCalledWith("Packaging ZIP 40%", expect.anything());
  await act(async () => { resolve(new Blob(["zip"])); await first; });
  expect(click).toHaveBeenCalledOnce();
});
