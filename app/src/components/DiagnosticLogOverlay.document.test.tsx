// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { DiagnosticLogOverlay } from "./DiagnosticLogOverlay";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@/hooks/useDiagnostics", () => ({ useDiagnostics: () => ({}) }));
vi.mock("./ResourceMonitor", () => ({ ResourceMonitor: () => null }));
vi.mock("./FeatureFlagsPanel", () => ({ FeatureFlagsPanel: () => null }));
vi.mock("@/lib/originalsStore", () => ({ sha256Hex: async (bytes: ArrayBuffer) => `hash-${new Uint8Array(bytes)[0]}` }));
vi.mock("@/lib/dexie/originalsAdapter", () => ({ getOriginal: async () => null }));

beforeEach(() => {
  useGalleryStore.setState({ activePhotoId: "a", documentPhotoId: "a", photos: [] });
  useUIStore.setState({ isImageLoading: false });
});

it("diagnostics hide outgoing dimensions and discard a late canvas hash after a photo switch", async () => {
  let completeA!: (png: Uint8Array) => void;
  const getA = vi.fn(() => new Promise<Uint8Array>(resolve => { completeA = resolve; }));
  const getB = vi.fn(async () => new Uint8Array([2]));
  const view = render(<DiagnosticLogOverlay open onClose={() => {}} imageMeta={{ photoId: "a", name: "Photo A", currentWidth: 10, currentHeight: 20, getCanvasPng: getA }} />);
  fireEvent.click(screen.getByRole("tab", { name: "Current Image Meta" }));
  await waitFor(() => expect(getA).toHaveBeenCalledOnce());
  expect(screen.getByText("10 × 20")).toBeTruthy();
  act(() => { useGalleryStore.setState({ activePhotoId: "b" }); });
  view.rerender(<DiagnosticLogOverlay open onClose={() => {}} imageMeta={{ photoId: "b", name: "Photo B", currentWidth: 10, currentHeight: 20, getCanvasPng: getB }} />);
  expect(screen.queryByText("10 × 20")).toBeNull();
  expect(screen.getByText("Photo B")).toBeTruthy();
  expect(getB).not.toHaveBeenCalled();
  act(() => { useGalleryStore.setState({ documentPhotoId: "b" }); });
  view.rerender(<DiagnosticLogOverlay open onClose={() => {}} imageMeta={{ photoId: "b", name: "Photo B", currentWidth: 30, currentHeight: 40, getCanvasPng: getB }} />);
  await waitFor(() => expect(screen.getByText("hash-2")).toBeTruthy());
  await act(async () => { completeA(new Uint8Array([1])); });
  expect(screen.queryByText("hash-1")).toBeNull();
  expect(screen.getByText("30 × 40")).toBeTruthy();
  view.unmount();
});

it("diagnostics do not expose a matching but unready engine", () => {
  const getPng = vi.fn();
  const view = render(<DiagnosticLogOverlay open onClose={() => {}} imageMeta={{ ready: false, photoId: "a", name: "Photo A", currentWidth: 10, currentHeight: 20, getCanvasPng: getPng }} />);
  fireEvent.click(screen.getByRole("tab", { name: "Current Image Meta" }));
  expect(screen.queryByText("10 × 20")).toBeNull();
  expect(getPng).not.toHaveBeenCalled();
  view.unmount();
});
