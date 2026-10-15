// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CurrentImagePane } from "./CurrentImagePane";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@/lib/originalsStore", () => ({ sha256Hex: async (bytes: ArrayBuffer) => `hash-${new Uint8Array(bytes)[0]}` }));
vi.mock("@/lib/dexie/originalsAdapter", () => ({ getOriginal: async () => null }));

beforeEach(() => {
  useGalleryStore.setState({ activePhotoId: "a", documentPhotoId: "a", photos: [] });
  useUIStore.setState({ isImageLoading: false });
});

it("Current Image hides outgoing dimensions and discard a late canvas hash after a photo switch", async () => {
  let completeA!: (png: Uint8Array) => void;
  const getA = vi.fn(() => new Promise<Uint8Array>(resolve => { completeA = resolve; }));
  const getB = vi.fn(async () => new Uint8Array([2]));
  const view = render(<CurrentImagePane active imageMeta={{ photoId: "a", name: "Photo A", currentWidth: 10, currentHeight: 20, getCanvasPng: getA }} />);
  await waitFor(() => expect(getA).toHaveBeenCalledOnce());
  expect(screen.getByText("10 × 20")).toBeTruthy();
  act(() => { useGalleryStore.setState({ activePhotoId: "b" }); });
  view.rerender(<CurrentImagePane active imageMeta={{ photoId: "b", name: "Photo B", currentWidth: 10, currentHeight: 20, getCanvasPng: getB }} />);
  expect(screen.queryByText("10 × 20")).toBeNull();
  expect(screen.getByText("Photo B")).toBeTruthy();
  expect(getB).not.toHaveBeenCalled();
  act(() => { useGalleryStore.setState({ documentPhotoId: "b" }); });
  view.rerender(<CurrentImagePane active imageMeta={{ photoId: "b", name: "Photo B", currentWidth: 30, currentHeight: 40, getCanvasPng: getB }} />);
  await waitFor(() => expect(screen.getByText("hash-2")).toBeTruthy());
  await act(async () => { completeA(new Uint8Array([1])); });
  expect(screen.queryByText("hash-1")).toBeNull();
  expect(screen.getByText("30 × 40")).toBeTruthy();
  view.unmount();
});

it("diagnostics do not expose a matching but unready engine", () => {
  const getPng = vi.fn();
  const view = render(<CurrentImagePane active imageMeta={{ ready: false, photoId: "a", name: "Photo A", currentWidth: 10, currentHeight: 20, getCanvasPng: getPng }} />);
  expect(screen.queryByText("10 × 20")).toBeNull();
  expect(getPng).not.toHaveBeenCalled();
  view.unmount();
});
