import { describe, it, expect, beforeEach } from "vitest";
import { textLookOf, pickTextLook, TEXT_LOOK_FIELDS } from "./textLook";
import { textBorderEngineArgs, textStrokeEngineArgs } from "./textOverlaySettings";
import { defaultToolSettings } from "./defaultToolSettings";
import { holdTextLookForEdit, releaseTextEditHold, useToolStore } from "@/stores/useToolStore";

// What `get_text_annotations` writes for a stamp: a bold green word in a
// transparent box with a 4 px border (ADR-109).
const STAMP = {
  background_kind: 1,
  bg_r: 22, bg_g: 163, bg_b: 74, bg_a: 0,
  bg_padding: 14, bg_corner_radius: 4, bg_tail: 0,
  shadow_box: false, shadow_text: false,
  shadow_r: 0, shadow_g: 0, shadow_b: 0, shadow_a: 0,
  shadow_dx: 0, shadow_dy: 0, shadow_blur: 0,
  stroke_width: 0, stroke_r: 0, stroke_g: 0, stroke_b: 0, stroke_a: 0,
  border_width: 4, border_r: 22, border_g: 163, border_b: 74, border_a: 255,
};

describe("textLookOf", () => {
  it("reads a stamp's box, border and transparent fill into panel fields", () => {
    const look = textLookOf(STAMP);
    expect(look).toMatchObject({
      bgKind: "rect",
      bgColor: "#16a34a",
      bgOpacity: 0,
      bgPadding: 14,
      bgCornerRadius: 4,
      textBorderWidth: 4,
      textBorderColor: "#16a34a",
      textBorderOpacity: 100,
      textStrokeWidth: 0,
    });
    expect(textBorderEngineArgs(look)).toEqual([4, "#16a34a", 255]);
  });

  it("every whole-percent opacity the panel writes comes back exactly", () => {
    for (let p = 0; p <= 100; p++) {
      const a = Math.round(p * 2.55);
      const look = textLookOf({ ...STAMP, bg_a: a, stroke_width: 2, stroke_a: a, border_a: a });
      expect(look.bgOpacity).toBe(p);
      expect(textStrokeEngineArgs(look)[2]).toBe(a);
      expect(textBorderEngineArgs(look)[2]).toBe(a);
    }
  });

  it("an older payload with no border or outline reads as none", () => {
    const look = textLookOf({ background_kind: 2, bg_r: 255, bg_g: 255, bg_b: 255, bg_a: 255 });
    expect(look.bgKind).toBe("bubble");
    expect(look.textBorderWidth).toBe(0);
    expect(look.textStrokeWidth).toBe(0);
    expect(look.shadowBox || look.shadowText).toBe(false);
  });

  it("covers exactly the fields it declares", () => {
    expect(Object.keys(textLookOf(STAMP)).sort()).toEqual([...TEXT_LOOK_FIELDS].sort());
  });
});

describe("the look held while an existing text is open", () => {
  beforeEach(() => {
    releaseTextEditHold();
    useToolStore.getState().setToolSettings({ ...defaultToolSettings });
  });

  it("shows the open text's look, then puts the panel's own back", () => {
    const before = pickTextLook(useToolStore.getState().toolSettings);
    expect(before.bgKind).toBe("none");
    holdTextLookForEdit(textLookOf(STAMP));
    const held = useToolStore.getState().toolSettings;
    expect(held.bgKind).toBe("rect");
    expect(held.textBorderWidth).toBe(4);
    releaseTextEditHold();
    expect(pickTextLook(useToolStore.getState().toolSettings)).toEqual(before);
  });

  it("opening a second text mid-edit still returns to the FIRST pre-edit look", () => {
    const before = pickTextLook(useToolStore.getState().toolSettings);
    holdTextLookForEdit(textLookOf(STAMP));
    holdTextLookForEdit(textLookOf({ ...STAMP, background_kind: 2, border_width: 0 }));
    expect(useToolStore.getState().toolSettings.bgKind).toBe("bubble");
    releaseTextEditHold();
    expect(pickTextLook(useToolStore.getState().toolSettings)).toEqual(before);
  });

  it("releasing with nothing held changes nothing", () => {
    const before = useToolStore.getState().toolSettings;
    releaseTextEditHold();
    expect(pickTextLook(useToolStore.getState().toolSettings)).toEqual(pickTextLook(before));
  });
});
