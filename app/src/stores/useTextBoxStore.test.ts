// The text box is TWO dimensions that have to stay one box.
//
// v8.40 shipped the width; v8.41 added the height so the six handles resize
// both axes. The failure this file exists to catch is the two drifting apart —
// one axis reset while the other keeps a stale value, which shows up as a fresh
// text annotation opening inside the previous one's box.
import { describe, it, expect, beforeEach } from "vitest";
import {
  useTextBoxStore,
  MIN_WRAP_WIDTH,
  MIN_BOX_HEIGHT,
} from "./useTextBoxStore";

const reset = () => useTextBoxStore.setState({ wrapWidth: 0, boxHeight: 0 });
const get = () => useTextBoxStore.getState();

describe("useTextBoxStore", () => {
  beforeEach(reset);

  it("starts unboxed on both axes — a fresh annotation is sized to its text", () => {
    expect(get().wrapWidth).toBe(0);
    expect(get().boxHeight).toBe(0);
  });

  it("clamps each axis to its own floor", () => {
    get().setWrapWidth(5);
    get().setBoxHeight(1);
    expect(get().wrapWidth).toBe(MIN_WRAP_WIDTH);
    expect(get().boxHeight).toBe(MIN_BOX_HEIGHT);
  });

  it("the height floor is lower than the width floor, deliberately", () => {
    // A box narrower than a couple of characters stops being a box; a box
    // SHORTER than its text is harmless, because the engine treats the height
    // as a minimum and the text sets the real floor.
    expect(MIN_BOX_HEIGHT).toBeLessThan(MIN_WRAP_WIDTH);
  });

  it("rounds to whole canvas pixels — the engine takes u32 on both axes", () => {
    get().setWrapWidth(240.6);
    get().setBoxHeight(310.4);
    expect(get().wrapWidth).toBe(241);
    expect(get().boxHeight).toBe(310);
  });

  it("0 and negatives mean 'size the box to the text', not the floor", () => {
    get().setWrapWidth(400);
    get().setBoxHeight(400);
    get().setWrapWidth(0);
    get().setBoxHeight(-5);
    expect(get().wrapWidth).toBe(0);
    expect(get().boxHeight).toBe(0);
  });

  it("REGRESSION: clearing resets BOTH axes", () => {
    // The one that matters. `clearWrapWidth` runs when a text input closes; if
    // it only cleared the width, the next annotation the user opened would
    // inherit the last one's height and open pre-stretched.
    get().setWrapWidth(240);
    get().setBoxHeight(310);
    get().clearWrapWidth();
    expect(get().wrapWidth).toBe(0);
    expect(get().boxHeight).toBe(0);
  });

  it("the axes are independent — setting one leaves the other alone", () => {
    get().setWrapWidth(240);
    get().setBoxHeight(310);
    get().setWrapWidth(180);
    expect(get().boxHeight).toBe(310);
    get().setBoxHeight(120);
    expect(get().wrapWidth).toBe(180);
  });
});
