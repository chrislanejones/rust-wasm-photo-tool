// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";

const h = vi.hoisted(() => ({ discard: vi.fn(), generate: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/cloud", () => ({
  CLOUD_CONFIGURED: true,
  useCloudMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === "photoEdits:discardFailedUpload" ? h.discard : h.upload,
  useCloudAction: () => h.generate,
  useCloudQuery: () => ({ daily: { cap: 10 } }),
}));
const { useImageGeneration } = await import("./useImageGeneration");
const { useUIStore } = await import("@/stores/useUIStore");
const req = { model: "test/model", prompt: "Test", aspectRatio: "1:1", referenceEdge: 100,
  references: [new File(["a"], "a.png"), new File(["b"], "b.png")] };

beforeEach(() => {
  vi.resetAllMocks();
  useUIStore.setState({ onlineFeaturesEnabled: true });
  h.upload.mockResolvedValue("https://upload.example");
  h.discard.mockResolvedValue({ deleted: false, reason: "referenced" });
  h.generate.mockResolvedValue({ jobId: "job" });
  vi.stubGlobal("createImageBitmap", async () => ({ width: 10, height: 10, close() {} }));
  vi.stubGlobal("OffscreenCanvas", class {
    getContext() { return { drawImage() {} }; }
    async convertToBlob() { return new Blob(["png"]); }
  });
});
afterEach(() => vi.unstubAllGlobals());

test("a failed second upload discards the first without dispatching a job", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ storageId: "first" }) })
    .mockResolvedValueOnce({ ok: false, status: 500 }));
  const { result } = renderHook(() => useImageGeneration(() => {}));
  await act(async () => { await result.current.run(req); });
  expect(result.current.phase).toBe("error");
  expect(h.generate).not.toHaveBeenCalled();
  expect(h.discard).toHaveBeenCalledExactlyOnceWith({ storageId: "first" });
});

test("dispatch errors offer every uploaded ID to the guarded cleanup", async () => {
  let n = 0;
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ storageId: `ref-${++n}` }) }));
  h.generate.mockRejectedValue(new Error("provider refused"));
  h.discard.mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useImageGeneration(() => {}));
  await act(async () => { await result.current.run(req); });
  expect(result.current.error).toBe("provider refused");
  expect(h.discard.mock.calls).toEqual([[{ storageId: "ref-1" }], [{ storageId: "ref-2" }]]);
});

test("successful dispatch preserves references for the running job", async () => {
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ storageId: "ref" }) }));
  const { result } = renderHook(() => useImageGeneration(() => {}));
  await act(async () => { await result.current.run(req); });
  expect(result.current.phase).toBe("running");
  expect(h.discard).not.toHaveBeenCalled();
});
