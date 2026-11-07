// @vitest-environment jsdom
// Compare mode, neither picked photo open: the second is opened as B and the
// pair starts once it's loaded. Review fix on #446 (11-07-2026): if B fails to
// open, or another photo is opened first, the pair is dropped and B unticked,
// so it can't start later out of nowhere.
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { toggleComparePick, usePendingComparePick } from "./comparePick";
import { useScreenshotCompareStore } from "@/stores/useScreenshotCompareStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";

/** Mimics the gallery's switch: the active photo moves at once, the pixels later. */
const openPhoto = (id: string) => {
  useGalleryStore.setState({ activePhotoId: id });
  useUIStore.setState({ isImageLoading: true, photoSwitchError: null });
};
const loaded = (id: string) => {
  useGalleryStore.setState({ documentPhotoId: id });
  useUIStore.setState({ isImageLoading: false });
};

function pickPair() {
  const cmp = useScreenshotCompareStore.getState();
  cmp.beginPick();
  toggleComparePick("a", openPhoto);
  toggleComparePick("b", openPhoto);
}

describe("usePendingComparePick", () => {
  beforeEach(() => {
    useScreenshotCompareStore.getState().stop();
    useGalleryStore.setState({ activePhotoId: "x", documentPhotoId: "x" });
    useUIStore.setState({ isImageLoading: false, photoSwitchError: null });
  });

  it("starts the pair once B is loaded", () => {
    renderHook(() => usePendingComparePick());
    act(() => {
      pickPair();
    });
    expect(useScreenshotCompareStore.getState().otherId).toBeNull();
    act(() => {
      loaded("b");
    });
    expect(useScreenshotCompareStore.getState()).toMatchObject({ otherId: "a", pending: null });
  });

  it("drops the pair and unticks B when B fails to open", () => {
    renderHook(() => usePendingComparePick());
    act(() => {
      pickPair();
    });
    act(() => {
      useUIStore.setState({ isImageLoading: false, photoSwitchError: "Couldn't open b" });
    });
    expect(useScreenshotCompareStore.getState()).toMatchObject({ otherId: null, pending: null, picks: ["a"] });
    // Opening b later for another reason doesn't start the old pair.
    act(() => {
      openPhoto("b");
      loaded("b");
    });
    expect(useScreenshotCompareStore.getState().otherId).toBeNull();
  });

  it("drops the pair when another photo is opened first", () => {
    renderHook(() => usePendingComparePick());
    act(() => {
      pickPair();
    });
    act(() => {
      openPhoto("c");
    });
    expect(useScreenshotCompareStore.getState()).toMatchObject({ pending: null, picks: ["a"] });
  });
});
