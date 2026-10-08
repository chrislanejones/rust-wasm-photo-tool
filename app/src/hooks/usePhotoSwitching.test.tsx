// @vitest-environment jsdom
import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";
import { isPhotoSwitching, useDelayedFlag, usePhotoSwitching } from "./usePhotoSwitching";
import { PerPhotoRegion } from "@/features/tools/PerPhotoRegion";
import { useLoadedDocument } from "./useLoadedDocument";

beforeEach(() => {
  useGalleryStore.setState({ activePhotoId: "A", documentPhotoId: "A", photos: [{ id: "A", name: "A" }] as ReturnType<typeof useGalleryStore.getState>["photos"] });
  useUIStore.setState({ isImageLoading: false, photoSwitchError: null });
});
afterEach(() => vi.useRealTimers());
describe("photo switch readiness", () => {
  it("locks the outgoing document while a save is pending, even before ids diverge", () => {
    const h = renderHook(() => usePhotoSwitching());
    act(() => { useUIStore.setState({ isImageLoading: true }); });
    expect(h.result.current).toBe(true);
    expect(isPhotoSwitching()).toBe(true);
  });
  it("does not unlock a mismatched document after fifteen seconds", () => {
    vi.useFakeTimers();
    useGalleryStore.setState({ documentPhotoId: "B" });
    const { container } = render(<PerPhotoRegion><input aria-label="Width" value="40" readOnly /></PerPhotoRegion>);
    act(() => { vi.advanceTimersByTime(16_000); });
    expect(container.querySelector('.per-photo-region')?.hasAttribute('inert')).toBe(true);
  });
  it("fast transitions do not flash a loading cue", () => {
    vi.useFakeTimers();
    const h = renderHook(({ active }) => useDelayedFlag(active), { initialProps: { active: true } });
    act(() => { vi.advanceTimersByTime(100); });
    h.rerender({ active: false });
    act(() => { vi.advanceTimersByTime(300); });
    expect(h.result.current).toBe(false);
  });
  it("engine readiness cannot unlock the wrong document, regardless of elapsed time", () => {
    vi.useFakeTimers();
    const state = { ready: true, width: 1200, undoCount: 4 };
    const h = renderHook(() => useLoadedDocument(state));
    act(() => { useGalleryStore.setState({ activePhotoId: "B" }); });
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(h.result.current).toBeNull();
  });
  it("a matching identity still requires a ready engine document", () => {
    const h = renderHook(({ ready }) => useLoadedDocument({ ready, width: 0 }), { initialProps: { ready: false } });
    expect(h.result.current).toBeNull();
    h.rerender({ ready: true });
    expect(h.result.current).not.toBeNull();
  });
});
