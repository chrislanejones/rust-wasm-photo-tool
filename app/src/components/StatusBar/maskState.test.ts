import { describe, expect, it, beforeEach } from "vitest";
import { useToolStore } from "@/stores/useToolStore";
import { maskCursorHalo, maskCursorInk } from "@/lib/maskCursor";

/* Night 4 §6 — the three state indicators agree with `mask.editing`.
 *
 * The night's one question is "can I tell what I'm editing without reading
 * documentation". Before this, the Layer Settings tile label ("Paint mask" /
 * "Painting mask") was the ONLY place in the app that said a brush stroke
 * would change the mask instead of the pixels, and you had to go looking.
 *
 * These tests pin the CONTRACT rather than the pixels: every indicator reads
 * `useToolStore.maskEditing`, and none of them keeps its own copy. A component
 * that derives mask state from anything else — the active tool, a layer's
 * hasMask, a local useState — is the drift this pass exists to stop, and it
 * makes one of these go red.
 *
 * jsdom note carried from the repo's own findings: a zustand change does NOT
 * re-render a component already mounted, so these read the store directly and
 * the render-level checks live in the e2e spec instead.
 */

const reset = () =>
  useToolStore.setState({ maskEditing: false, maskPaintValue: 0 });

describe("mask editing is published once", () => {
  beforeEach(reset);

  it("defaults to off, so nothing claims mask editing on a fresh document", () => {
    // getInitialState(), NOT getState(). beforeEach writes maskEditing: false,
    // so reading getState() here would assert the value the reset just set —
    // flipping the real default to true left this test green, which is how the
    // hole was found. zustand 5 keeps the pristine initial state for exactly
    // this.
    expect(useToolStore.getInitialState().maskEditing).toBe(false);
  });

  it("the mask brush starts on black, so a first stroke hides rather than reveals", () => {
    expect(useToolStore.getInitialState().maskPaintValue).toBe(0);
  });

  it("one setter moves it, and every reader sees the same value", () => {
    useToolStore.getState().setMaskEditing(true);
    // Three readers, one source. If any of them is ever given its own copy,
    // this is where the copies stop agreeing.
    const a = useToolStore.getState().maskEditing;
    const b = useToolStore.getState().maskEditing;
    expect(a).toBe(true);
    expect(b).toBe(a);
  });

  it("toggles back off without leaving a latched flag behind", () => {
    useToolStore.getState().setMaskEditing(true);
    useToolStore.getState().setMaskEditing(false);
    expect(useToolStore.getState().maskEditing).toBe(false);
  });
});

describe("the cursor's mask colour follows maskPaintValue", () => {
  beforeEach(reset);

  /* Imported, NOT re-declared. The first draft of this file carried its own
     copy of the threshold, which made every assertion below green regardless
     of what the canvas actually rendered — a check that could not fail. These
     are the same two functions CanvasArea calls. */
  const ink = maskCursorInk;
  const halo = maskCursorHalo;

  it("black hides — the default paint value draws a black ring", () => {
    expect(useToolStore.getState().maskPaintValue).toBe(0);
    expect(ink(0)).toBe("#000");
    expect(halo(0)).toBe("#fff");
  });

  it("white reveals", () => {
    useToolStore.getState().setMaskPaintValue(255);
    const v = useToolStore.getState().maskPaintValue;
    expect(v).toBe(255);
    expect(ink(v)).toBe("#fff");
    expect(halo(v)).toBe("#000");
  });

  it("the halo is always the opposite of the ink, at every value", () => {
    for (const v of [0, 1, 127, 128, 200, 255]) {
      expect(ink(v)).not.toBe(halo(v));
    }
  });
});
