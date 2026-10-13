// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";
import { useToolStore } from "@/stores/useToolStore";
import { useDocumentQuality } from "./useDocumentQuality";

beforeEach(() => {
  useGalleryStore.setState({ activePhotoId: 'A', documentPhotoId: 'A', documentRevision: 1 });
  useUIStore.setState({ isImageLoading: false });
  useToolStore.setState({ quality: 42 });
});
it('restores engine quality without replacing it with the previous draft', () => {
  const h = renderHook(p => useDocumentQuality(p), { initialProps: { ready: true, exportQuality: 75 } });
  expect(h.result.current).toBe(75);
  act(() => { useToolStore.getState().setQuality(60); });
  expect(h.result.current).toBe(60);
  act(() => { useGalleryStore.setState({ activePhotoId: 'B' }); });
  h.rerender({ ready: true, exportQuality: 90 });
  expect(useToolStore.getState().quality).toBe(60);
  act(() => { useGalleryStore.setState({ documentPhotoId: 'B', documentRevision: 2 }); });
  expect(h.result.current).toBe(90);
  expect(useToolStore.getState().quality).toBe(90);
});
it('undo and redo replace the draft with the committed value', () => {
  const h = renderHook(p => useDocumentQuality(p), { initialProps: { ready: true, exportQuality: 70 } });
  act(() => { useToolStore.getState().setQuality(45); });
  h.rerender({ ready: true, exportQuality: 75 });
  expect(h.result.current).toBe(75);
  h.rerender({ ready: true, exportQuality: 70 });
  expect(h.result.current).toBe(70);
});
it('a new committed document with identical applied quality still discards an old draft', () => {
  const h = renderHook(() => useDocumentQuality({ ready: true, exportQuality: 75 }));
  act(() => { useToolStore.getState().setQuality(50); });
  act(() => { useGalleryStore.setState({ documentRevision: 2 }); });
  expect(h.result.current).toBe(75);
});
