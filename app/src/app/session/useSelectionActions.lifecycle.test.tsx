// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useSelectionActions } from "./useSelectionActions";
import { useToolStore } from "@/stores/useToolStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";
import { CLEAN_UP } from "@/lib/selectionRefine";
import { toast } from "@/components/ui/sonner";

vi.mock("@/hooks/useCanvasCoords", () => ({ useCanvasCoords: () => () => ({ x: 0, y: 0 }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: vi.fn(), dismiss: vi.fn() } }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useGalleryStore.setState({ activePhotoId: "a", documentPhotoId: "a", documentRevision: 1 });
  useUIStore.setState({ isImageLoading: false });
  useToolStore.setState({ activeTool: "select", selectionMask: new Uint8Array([1]), selectionRefine: CLEAN_UP, refinePreviewing: false, refineBusy: false });
});
afterEach(() => vi.useRealTimers());

function setup(pending = false) {
  let resolve!: (mask: Uint8Array) => void;
  const committed = new Uint8Array([4]);
  const tool = {
    has_selection: vi.fn(async () => true),
    selection_refine_preview: vi.fn(() => pending ? new Promise<Uint8Array>((r) => { resolve = r; }) : Promise.resolve(new Uint8Array([9]))),
    selection_refine_cancel: vi.fn(async () => undefined),
    selection_overlay: vi.fn(async () => committed),
    selection_coverage: vi.fn(async () => new Uint32Array([1, 4])),
    selection_refine_preview_coverage: vi.fn(async () => new Uint32Array([2, 4])),
  };
  const stamp = { toolRef: { current: tool }, state: { width: 2, height: 2 }, syncState: vi.fn() };
  const hook = renderHook(() => useSelectionActions(stamp as unknown as Parameters<typeof useSelectionActions>[0], { current: null }));
  return { tool, committed, hook, resolve: (mask: Uint8Array) => resolve(mask) };
}

async function preview() {
  act(() => { useToolStore.getState().setSelectionRefine({ ...CLEAN_UP, expand: 8 }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(70); });
}

it("leaving Select cancels preview and restores committed ants without applying", async () => {
  const { tool, committed } = setup();
  await preview();
  expect(useToolStore.getState().refinePreviewing).toBe(true);
  await act(async () => { useToolStore.getState().setActiveTool("arrow"); });
  expect(tool.selection_refine_cancel).toHaveBeenCalledOnce();
  expect(useToolStore.getState().refinePreviewing).toBe(false);
  expect(useToolStore.getState().selectionMask).toBe(committed);
});

it("leaving while preview is pending rejects the late answer and cancels its engine copy", async () => {
  const { tool, committed, resolve } = setup(true);
  await preview();
  expect(useToolStore.getState().refineBusy).toBe(true);
  await act(async () => { useToolStore.getState().setActiveTool("arrow"); });
  await act(async () => { resolve(new Uint8Array([9])); });
  expect(tool.selection_refine_cancel).toHaveBeenCalledOnce();
  expect(useToolStore.getState().selectionMask).toBe(committed);
  expect(useToolStore.getState().refinePreviewing).toBe(false);
  expect(useToolStore.getState().refineBusy).toBe(false);
});

it("preview failures remain visible and finish their busy state", async () => {
  const { tool } = setup();
  tool.selection_refine_preview.mockRejectedValueOnce(new Error("worker failed"));
  await preview();
  expect(useToolStore.getState().refineBusy).toBe(false);
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Couldn't preview"), expect.objectContaining({ duration: Infinity, action: expect.anything() }));
});

it("a switch clears the preview without putting outgoing ants onto the new photo", async () => {
  const { tool, resolve } = setup(true);
  await preview();
  act(() => { useGalleryStore.setState({ activePhotoId: "b" }); });
  await act(async () => { resolve(new Uint8Array([9])); });
  expect(tool.selection_overlay).not.toHaveBeenCalled();
  expect(useToolStore.getState().refinePreviewing).toBe(false);
  expect(useToolStore.getState().selectionCoverage).toBeNull();
});
