import { describe, it, expect, beforeEach } from "vitest";
import { commitPreferences, readPreferences } from "@/lib/preferences";
import {
  holdTextAlignForEdit,
  isTextAlignHeldForEdit,
  restoreTextAlignPreference,
  useToolStore,
} from "./useToolStore";

// 11-10 Q2: an existing text open in the editor shows ITS Text in Box cell,
// and a grid change during that edit is the text's own, not the preference.
describe("the Text in Box cell held for an edit", () => {
  beforeEach(() => {
    commitPreferences({ ...readPreferences(), textAlign: "top-center" });
    restoreTextAlignPreference();
  });

  it("shows the open text's cell and marks the edit as holding it", () => {
    expect(isTextAlignHeldForEdit()).toBe(false);
    holdTextAlignForEdit("bottom-right");
    expect(isTextAlignHeldForEdit()).toBe(true);
    expect(useToolStore.getState().toolSettings.textAlign).toBe("bottom-right");
    expect(readPreferences().textAlign, "the preference is untouched").toBe("top-center");
  });

  it("closing the editor puts the preference back and releases the hold", () => {
    holdTextAlignForEdit("top-left");
    restoreTextAlignPreference();
    expect(isTextAlignHeldForEdit()).toBe(false);
    expect(useToolStore.getState().toolSettings.textAlign).toBe("top-center");
  });
});
