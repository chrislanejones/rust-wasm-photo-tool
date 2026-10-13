// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { GridThumbnails } from "./GridThumbnails";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useToolStore } from "@/stores/useToolStore";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
let probes: FakeImage[];
class FakeImage {
  src = ""; onload: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor() { probes.push(this); }
}
const photos = (count: number): PhotoEntry[] => Array.from({ length: count }, (_, n) => ({ id: String(n), name: `Photo ${n}`, thumbBlob: new Blob([String(n)]), origWidth: 100, origHeight: 100, workingWidth: 100, workingHeight: 100 }) as PhotoEntry);
beforeEach(() => { probes = []; vi.useFakeTimers(); vi.stubGlobal("Image", FakeImage); useToolStore.setState({ activeTool: "emoji" }); useGalleryStore.setState({ selectedIds: new Set() }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const grid = (items: PhotoEntry[], select = vi.fn(), active = "0") => <TooltipProvider><GridThumbnails photos={items} activePhotoId={active} onSelectPhoto={select} /></TooltipProvider>;

it("loads only the page's eleven thumbnails, preserving selection through failure", () => {
  const select = vi.fn(); const items = photos(24);
  const { container } = render(grid(items, select));
  expect(probes).toHaveLength(11);
  act(() => vi.advanceTimersByTime(301));
  expect(container.querySelectorAll('.skeleton')).toHaveLength(11);
  act(() => probes[0]!.onerror!());
  expect(screen.getByRole('img', { name: /Photo 1 could not be displayed/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Photo 1', exact: true }));
  expect(select).toHaveBeenCalledWith(items[1]);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Exception: Photo 1', exact: true }));
  expect(useGalleryStore.getState().selectedIds.has('1')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Next photos' }));
  expect(screen.getByText(/Page 2 of 3/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Photo 1', exact: true })).toBeNull();
  expect(probes).toHaveLength(22);
  fireEvent.click(screen.getByRole('button', { name: 'Previous photos' }));
  expect((screen.getByRole('checkbox', { name: 'Exception: Photo 1', exact: true }) as HTMLInputElement).checked).toBe(true);
});

it("keeps a decoded tile during an update and clamps pagination after removal", () => {
  const items = photos(24); const { rerender, container } = render(grid(items));
  act(() => probes[0]!.onload!());
  const old = screen.getByRole('img', { name: 'Photo 1', exact: true }).getAttribute('src');
  const updated = items.map(p => p.id === '1' ? { ...p, thumbBlob: new Blob(['edited']) } : p);
  rerender(grid(updated));
  act(() => vi.advanceTimersByTime(301));
  expect(screen.getByRole('img', { name: 'Photo 1', exact: true }).getAttribute('src')).toBe(old);
  fireEvent.click(screen.getByRole('button', { name: 'Next photos' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next photos' }));
  expect(screen.getByText(/Page 3 of 3/)).toBeTruthy();
  rerender(grid(updated.slice(0, 3), vi.fn(), '1'));
  expect(screen.getByRole('button', { name: 'Photo 0', exact: true })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Photo 1', exact: true })).toBeNull();
  expect(container.querySelectorAll('button[aria-label^="Photo"]')).toHaveLength(2);
});
