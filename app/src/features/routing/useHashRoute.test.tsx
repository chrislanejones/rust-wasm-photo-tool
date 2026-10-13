// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { useHashRoute } from "./useHashRoute";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { useGalleryStore } from "@/stores/useGalleryStore";

beforeEach(() => {
  history.replaceState(null, "", "/");
  useGalleryStore.setState({ activePhotoId: "a", documentPhotoId: "a" });
  useToolStore.setState({ activeTool: "select", activeSubTool: "select/wand", selectionKind: "wand" });
  useUIStore.setState({ settingsOpen: false, isImageLoading: false });
});

it("coverage and loading updates cannot overwrite an incoming route before hashchange", () => {
  renderHook(() => useHashRoute());
  act(() => {
    history.replaceState(null, "", "/#/edit/resize-layer");
    useToolStore.getState().setSelectionCoverage({ selected: 2, total: 10 });
    useUIStore.setState({ isImageLoading: true });
    useGalleryStore.setState({ layerRevision: 1 });
  });
  expect(location.hash).toBe("#/edit/resize-layer");
  act(() => { window.dispatchEvent(new HashChangeEvent("hashchange")); });
  expect(useToolStore.getState().activeTool).toBe("arrow");
  expect(useToolStore.getState().activeSubTool).toBe("edit/resize-layer");
});

it("real tool changes still update the URL and leave normal navigation usable", () => {
  renderHook(() => useHashRoute());
  act(() => { useToolStore.setState({ activeTool: "brush", activeSubTool: "create/brush", brushMode: "paint" }); });
  expect(location.hash).toBe("#/create/brush");
});
