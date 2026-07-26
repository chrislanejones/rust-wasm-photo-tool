// @vitest-environment jsdom
// ===== FILE: app/src/app/useKeyboardShortcuts.test.ts =====
// Regression coverage for the global keydown handler — specifically the new
// Enter -> apply-pending-crop wiring (onApplyCrop/hasCropSelection), pinned
// against the `isActivatable` focused-control guard so a Tab-focused button's
// native Enter activation is never stolen.
//
// This hook is DOM-wired (window.addEventListener, HTMLElement/Element
// instanceof checks) and can only run inside a live React effect, so this
// file opts into vitest's jsdom environment (the rest of the suite stays on
// the default `node` environment — see vitest.config.ts) and mounts the hook
// via a tiny real react-dom root rather than any hand-rolled DOM shim.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { GROUP_BY_KEY, TOOL_GROUPS } from "@/features/tools/toolGroups";

// React 19 warns ("not configured to support act(...)") unless this flag is
// set before any act() call — harmless in real app code (never imported
// there), but without it here dispatchEvent-inside-act can intermittently
// warn/misbehave under jsdom.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = Parameters<typeof useKeyboardShortcuts>[0];

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onExport: vi.fn(),
    onDeleteAll: vi.fn(),
    onAdjustBrushSize: vi.fn(),
    setShowUpload: vi.fn(),
    setShowTools: vi.fn(),
    setShowGallery: vi.fn(),
    setShowHistory: vi.fn(),
    setShowShortcutModal: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

function mount(props: Props) {
  function Harness(p: Props) {
    useKeyboardShortcuts(p);
    return null;
  }
  act(() => {
    root.render(React.createElement(Harness, props));
  });
}

function rerender(props: Props) {
  mount(props);
}

/** Fire a real keydown that bubbles from `target` up to `window`, matching
 *  how the browser actually dispatches (the handler is attached on window;
 *  `e.target` must be the focused element, not window itself). */
function pressEnter(target: EventTarget = window) {
  const evt = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(evt);
  });
}

/** Ctrl+C, dispatched from `target` so the input/textarea guard is exercised. */
function pressCtrlC(target: EventTarget = window) {
  const evt = new KeyboardEvent("keydown", {
    key: "c",
    code: "KeyC",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(evt);
  });
}

/** Ctrl+J (optionally +Shift), same dispatch shape as pressCtrlC. */
function pressCtrlJ(target: EventTarget = window, shift = false) {
  const evt = new KeyboardEvent("keydown", {
    key: shift ? "J" : "j",
    code: "KeyJ",
    ctrlKey: true,
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(evt);
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("GROUP_BY_KEY agrees with the group registry (one contract, stated twice)", () => {
  // GROUP_BY_KEY is DERIVED from TOOL_GROUPS, so this can no longer drift the
  // way the old hand-written TOOL_BY_KEY did (it silently omitted Select for
  // three releases). The test stays anyway: it pins the derivation itself, and
  // it is the thing that fails loudly if someone reintroduces a literal table.
  const toCode = (k: string) => `Digit${k}`;

  it("every group's shortcutKey resolves through GROUP_BY_KEY to that same group", () => {
    for (const group of TOOL_GROUPS) {
      expect(GROUP_BY_KEY[toCode(group.shortcutKey)]).toBe(group.id);
    }
  });

  it("has no entries beyond what the five groups define", () => {
    const expectedCodes = new Set(TOOL_GROUPS.map((g) => toCode(g.shortcutKey)));
    expect(new Set(Object.keys(GROUP_BY_KEY))).toEqual(expectedCodes);
  });

  it("binds exactly the digits 1-5", () => {
    expect(Object.keys(GROUP_BY_KEY).sort()).toEqual([
      "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
    ]);
  });
});

describe("Enter -> apply pending crop", () => {
  it("no-ops when there is no crop selection", () => {
    const onApplyCrop = vi.fn();
    mount(baseProps({ onApplyCrop, hasCropSelection: false }));
    pressEnter();
    expect(onApplyCrop).not.toHaveBeenCalled();
  });

  it("applies the crop when a selection exists", () => {
    const onApplyCrop = vi.fn();
    mount(baseProps({ onApplyCrop, hasCropSelection: true }));
    pressEnter();
    expect(onApplyCrop).toHaveBeenCalledTimes(1);
  });

  it("does not fire while focus is on a text input (top-level typing guard)", () => {
    const onApplyCrop = vi.fn();
    mount(baseProps({ onApplyCrop, hasCropSelection: true }));
    const input = document.createElement("input");
    container.appendChild(input);
    input.focus();
    pressEnter(input);
    expect(onApplyCrop).not.toHaveBeenCalled();
  });

  it("does not fire while focus is on an activatable, enabled button (isActivatable guard)", () => {
    // A Tab-focused button must get its native Enter-activates-click behavior;
    // the crop shortcut must not steal it.
    const onApplyCrop = vi.fn();
    mount(baseProps({ onApplyCrop, hasCropSelection: true }));
    const button = document.createElement("button");
    container.appendChild(button);
    button.focus();
    pressEnter(button);
    expect(onApplyCrop).not.toHaveBeenCalled();
  });

  it("still fires when the focused control is a DISABLED button (isActivatable's own carve-out)", () => {
    // isActivatable explicitly refuses to guard for a disabled control (it
    // can't activate anyway), so the crop shortcut should win.
    const onApplyCrop = vi.fn();
    mount(baseProps({ onApplyCrop, hasCropSelection: true }));
    const button = document.createElement("button");
    button.disabled = true;
    container.appendChild(button);
    // A disabled button can't take real focus, but the guard reads whatever
    // dispatched the event, not document.activeElement — dispatch straight
    // off it to exercise the disabled carve-out specifically.
    pressEnter(button);
    expect(onApplyCrop).toHaveBeenCalledTimes(1);
  });

  it("re-reads hasCropSelection/onApplyCrop on every render (no stale closure)", () => {
    const onApplyCrop = vi.fn();
    mount(baseProps({ onApplyCrop, hasCropSelection: false }));
    pressEnter();
    expect(onApplyCrop).not.toHaveBeenCalled();

    rerender(baseProps({ onApplyCrop, hasCropSelection: true }));
    pressEnter();
    expect(onApplyCrop).toHaveBeenCalledTimes(1);
  });

  it("does nothing when hasCropSelection is true but onApplyCrop was never provided", () => {
    // Guards against a crash if a caller wires the flag without the callback.
    expect(() => {
      mount(baseProps({ onApplyCrop: undefined, hasCropSelection: true }));
      pressEnter();
    }).not.toThrow();
  });
});

describe("sanity: the harness actually reaches the real handler", () => {
  // A canary — if window-level event delivery were broken, every test above
  // would pass for the wrong reason (nothing ever firing). Undo/redo and the
  // bare-digit tool switch are the simplest independent proof the listener is
  // live and wired to the real module code.
  it("Ctrl+Z calls onUndo", () => {
    const onUndo = vi.fn();
    mount(baseProps({ onUndo }));
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
      );
    });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("bare digit 3 selects the Create group", () => {
    const onGroupChange = vi.fn();
    mount(baseProps({ onGroupChange }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit3", bubbles: true }));
    });
    expect(onGroupChange).toHaveBeenCalledWith("create");
  });

  it("bare digit 2 selects Select — no longer Adjust, the digits moved to groups", () => {
    const onGroupChange = vi.fn();
    mount(baseProps({ onGroupChange }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit2", bubbles: true }));
    });
    expect(onGroupChange).toHaveBeenCalledWith("select");
  });

  it("bare digit 5 selects the Batch group", () => {
    const onGroupChange = vi.fn();
    mount(baseProps({ onGroupChange }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit5", bubbles: true }));
    });
    expect(onGroupChange).toHaveBeenCalledWith("batch");
  });

  it("digits 6-0 and Minus are now INERT — the rail is five wide", () => {
    // The old eleven-tool rail ran 1-9, 0, then Minus. Those keys must no
    // longer fire anything, or a muscle-memory `7` would silently activate
    // whatever the fifth group's first sub-tool happens to be.
    const onGroupChange = vi.fn();
    mount(baseProps({ onGroupChange }));
    for (const code of ["Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus"]) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
      });
    }
    expect(onGroupChange).not.toHaveBeenCalled();
  });

  it("Alt+Minus still zooms out rather than switching groups", () => {
    // Minus is no longer a bare binding at all (the rail is five wide), but the
    // Alt branch must keep working — and must keep returning before the bare
    // digit path, which is the collision this has always guarded.
    const onGroupChange = vi.fn();
    const onZoomOut = vi.fn();
    mount(baseProps({ onGroupChange, onZoomOut }));
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Minus", altKey: true, bubbles: true }),
      );
    });
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onGroupChange).not.toHaveBeenCalled();
  });
});

describe("Ctrl+J / Ctrl+Shift+J -> selection to a new layer", () => {
  // The handler is gated on `hasSelection` BEFORE preventDefault, so with
  // nothing selected the browser keeps its own Ctrl+J; and it sits behind the
  // same input/textarea/contentEditable guard as every other combo, so it
  // can never fire while the user is typing a "j" into a caption.
  it("fires copy-to-new-layer on the canvas when something is selected", () => {
    const onNewLayerCopy = vi.fn();
    const onNewLayerCut = vi.fn();
    mount(baseProps({ onNewLayerCopy, onNewLayerCut, hasSelection: true }));
    pressCtrlJ(window);
    expect(onNewLayerCopy).toHaveBeenCalledTimes(1);
    expect(onNewLayerCut).not.toHaveBeenCalled();
  });

  it("fires cut-to-new-layer with Shift held", () => {
    const onNewLayerCopy = vi.fn();
    const onNewLayerCut = vi.fn();
    mount(baseProps({ onNewLayerCopy, onNewLayerCut, hasSelection: true }));
    pressCtrlJ(window, true);
    expect(onNewLayerCut).toHaveBeenCalledTimes(1);
    expect(onNewLayerCopy).not.toHaveBeenCalled();
  });

  it("does NOT fire when nothing is selected (browser keeps Ctrl+J)", () => {
    const onNewLayerCopy = vi.fn();
    const onNewLayerCut = vi.fn();
    mount(baseProps({ onNewLayerCopy, onNewLayerCut, hasSelection: false }));
    pressCtrlJ(window);
    pressCtrlJ(window, true);
    expect(onNewLayerCopy).not.toHaveBeenCalled();
    expect(onNewLayerCut).not.toHaveBeenCalled();
  });

  it("does NOT fire from inside a <textarea> (typing guard)", () => {
    const onNewLayerCopy = vi.fn();
    const onNewLayerCut = vi.fn();
    mount(baseProps({ onNewLayerCopy, onNewLayerCut, hasSelection: true }));
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    pressCtrlJ(ta);
    pressCtrlJ(ta, true);
    expect(onNewLayerCopy).not.toHaveBeenCalled();
    expect(onNewLayerCut).not.toHaveBeenCalled();
    ta.remove();
  });

  it("does nothing (and does not throw) when the callbacks were never provided", () => {
    expect(() => {
      mount(baseProps({ hasSelection: true }));
      pressCtrlJ(window);
      pressCtrlJ(window, true);
    }).not.toThrow();
  });
});

describe("Ctrl+C never steals a text box's native copy", () => {
  // useCopyRegionAction's header states "Text boxes copy as text natively
  // (real <textarea>)". That promise rests entirely on the input/textarea/
  // contentEditable guard at the top of the keydown handler — nothing else
  // enforces it. Since region copy now samples the VISIBLE COMPOSITE
  // (copy_region_composited) rather than the active layer, a regression here
  // would mean selecting text in a caption and getting a PNG of the canvas
  // on the clipboard instead of the characters.
  it("fires region copy when the canvas has focus", () => {
    const onCopyRegion = vi.fn();
    mount(baseProps({ onCopyRegion }));
    pressCtrlC(window);
    expect(onCopyRegion).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire region copy from inside a <textarea>", () => {
    const onCopyRegion = vi.fn();
    mount(baseProps({ onCopyRegion }));
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    pressCtrlC(ta);
    expect(onCopyRegion).not.toHaveBeenCalled();
    ta.remove();
  });

  it("does NOT fire region copy from inside an <input>", () => {
    const onCopyRegion = vi.fn();
    mount(baseProps({ onCopyRegion }));
    const input = document.createElement("input");
    document.body.appendChild(input);
    pressCtrlC(input);
    expect(onCopyRegion).not.toHaveBeenCalled();
    input.remove();
  });

  it("does NOT fire region copy from a contentEditable element", () => {
    const onCopyRegion = vi.fn();
    mount(baseProps({ onCopyRegion }));
    const div = document.createElement("div");
    // jsdom does NOT implement `isContentEditable` — setting the
    // `contentEditable` attribute leaves it false, so without this the test
    // would fail against a jsdom gap rather than against our guard. Define it
    // so the handler's real `e.target.isContentEditable` branch is exercised.
    Object.defineProperty(div, "isContentEditable", {
      value: true,
      configurable: true,
    });
    document.body.appendChild(div);
    pressCtrlC(div);
    expect(onCopyRegion).not.toHaveBeenCalled();
    div.remove();
  });
});
