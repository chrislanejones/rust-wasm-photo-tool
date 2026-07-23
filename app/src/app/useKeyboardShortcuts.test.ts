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
import { useKeyboardShortcuts, TOOL_BY_DIGIT } from "./useKeyboardShortcuts";
import { TOOLS } from "@/features/tools/toolConfig";

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

describe("TOOL_BY_DIGIT agrees with toolConfig.ts (one contract, stated twice)", () => {
  // toolConfig.ts's ToolDefinition.shortcutKey doc-comment claims it "mirrors
  // TOOL_BY_DIGIT in useKeyboardShortcuts.ts" — this is the only place that
  // claim is actually checked. If someone adds/reorders a tool in one table
  // without the other, digit keys and the sidebar/palette shortcut hints
  // silently disagree about which key does what.
  it("every tool's shortcutKey resolves through TOOL_BY_DIGIT to that same tool", () => {
    for (const tool of TOOLS) {
      const code = tool.shortcutKey === "0" ? "Digit0" : `Digit${tool.shortcutKey}`;
      expect(TOOL_BY_DIGIT[code]).toBe(tool.id);
    }
  });

  it("has no digit entries beyond what toolConfig.ts's ten tools define", () => {
    const expectedCodes = new Set(
      TOOLS.map((t) => (t.shortcutKey === "0" ? "Digit0" : `Digit${t.shortcutKey}`)),
    );
    expect(new Set(Object.keys(TOOL_BY_DIGIT))).toEqual(expectedCodes);
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

  it("bare digit 3 switches to the Paint tool", () => {
    const onToolChange = vi.fn();
    mount(baseProps({ onToolChange }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit3", bubbles: true }));
    });
    expect(onToolChange).toHaveBeenCalledWith("brush");
  });

  it("bare digit 6 switches to the Eraser tool (id stays 'ai')", () => {
    const onToolChange = vi.fn();
    mount(baseProps({ onToolChange }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit6", bubbles: true }));
    });
    expect(onToolChange).toHaveBeenCalledWith("ai");
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
