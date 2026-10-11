// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";
import { useResizeCompress } from "./useResizeCompress";
vi.mock('@/components/ui/sonner', () => ({ toast: { info: vi.fn() } }));
beforeEach(() => {
  useGalleryStore.setState({ activePhotoId: 'A', documentPhotoId: 'A', documentRevision: 1, photos: [{ id: 'A', mimeType: 'image/png' }] as ReturnType<typeof useGalleryStore.getState>['photos'] });
  useUIStore.setState({ isImageLoading: false });
});
function setup() {
  const tool = { push_compress_marker: vi.fn(), set_export_quality: vi.fn() };
  const stamp = { state: { width: 256, height: 256, undoCount: 0, redoCount: 0 }, toolRef: { current: tool }, resizeWithFilter: vi.fn(), syncState: vi.fn(async () => {}) };
  const persist = vi.fn(async () => ({ status: 'saved' }));
  const props = { stamp, photoBounds: null, quality: 60, activePhotoId: 'A', persistActiveCanvas: persist, setHasBeenModified: vi.fn(), setModifiedPhotos: vi.fn() } as unknown as Parameters<typeof useResizeCompress>[0];
  return { ...renderHook(() => useResizeCompress(props)), tool, stamp, persist };
}
it('guards programmatic Apply calls while the wrong document is loaded', async () => {
  const h = setup();
  act(() => { useGalleryStore.setState({ activePhotoId: 'B' }); });
  expect(await h.result.current.applyCompression(256, 256, 3)).toBe(false);
  expect(await h.result.current.applyResizeOnly(128, 128, 3)).toBe(false);
  expect(h.tool.push_compress_marker).not.toHaveBeenCalled();
  expect(h.stamp.resizeWithFilter).not.toHaveBeenCalled();
});
it('commits the displayed PNG quality as one undoable setting', async () => {
  const h = setup();
  expect(await h.result.current.applyCompression(256, 256, 3)).toBe(true);
  expect(h.tool.push_compress_marker).toHaveBeenCalledWith(60);
  expect(h.stamp.syncState).toHaveBeenCalledOnce();
});
it('combined resize and compression retain the displayed quality in the resized snapshot', async () => {
  const h = setup();
  expect(await h.result.current.applyCompression(128, 128, 3)).toBe(true);
  expect(h.tool.set_export_quality).toHaveBeenCalledWith(60);
  expect(h.tool.push_compress_marker).not.toHaveBeenCalled();
});
it('a save finishing after a switch cannot change the incoming document quality', async () => {
  const h = setup();
  let resolve!: (v: { status: string }) => void;
  h.persist.mockReturnValue(new Promise(res => { resolve = res; }));
  const pending = h.result.current.applyCompression(128, 128, 3);
  act(() => { useGalleryStore.setState({ activePhotoId: 'B', documentPhotoId: 'B', documentRevision: 2 }); });
  resolve({ status: 'saved' });
  expect(await pending).toBe(false);
  expect(h.tool.set_export_quality).not.toHaveBeenCalled();
});
