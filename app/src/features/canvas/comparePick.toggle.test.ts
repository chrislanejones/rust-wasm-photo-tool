// Compare two photos is ONE action in both layouts (11-15-2026): the top bar's
// button (wide) and the docked Gallery tab's tile (compact). They differ only
// in which gallery opens: the wide strip, or the master bar's Gallery tab.
import { describe, it, expect, beforeEach } from "vitest";
import { toggleCompareMode } from "./comparePick";
import { useScreenshotCompareStore } from "@/stores/useScreenshotCompareStore";
import { useUIStore } from "@/stores/useUIStore";

describe("toggleCompareMode", () => {
  beforeEach(() => {
    useScreenshotCompareStore.getState().stop();
    useUIStore.setState({ showGallery: false, masterTab: "tools" });
  });

  it("wide: compare mode on, and the gallery strip opens", () => {
    toggleCompareMode();
    expect(useScreenshotCompareStore.getState().picking).toBe(true);
    expect(useUIStore.getState()).toMatchObject({ showGallery: true, masterTab: "tools" });
  });

  it("dock: compare mode on, and the master bar's Gallery tab opens; the wide strip's flag is left alone", () => {
    toggleCompareMode("dock");
    expect(useScreenshotCompareStore.getState().picking).toBe(true);
    expect(useUIStore.getState()).toMatchObject({ showGallery: false, masterTab: "gallery" });
  });

  it("either way, a second call ends it, comparison and all", () => {
    toggleCompareMode("dock");
    useScreenshotCompareStore.setState({ picks: ["a", "b"], otherId: "a" });
    toggleCompareMode("dock");
    expect(useScreenshotCompareStore.getState()).toMatchObject({ picking: false, picks: [], otherId: null });
  });
});
