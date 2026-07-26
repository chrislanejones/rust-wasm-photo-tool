// ===== FILE: app/src/features/routing/routeState.test.ts =====
// The grammar tests (routes.test.ts) pin the string contract. These pin the
// STATE contract against the real Zustand stores: a hash drives the app to the
// view it names, the app reports the hash it's at, and the two agree — which
// is exactly the property the URL<->state mirror's loop guard rests on.
import { describe, it, expect, beforeEach } from "vitest";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { applyRoute, currentHash, parseHash, readRoute, describeRoute } from "./routeState";

beforeEach(() => {
  useToolStore.setState({
    activeTool: "compress",
    brushMode: "paint",
    resizeMode: "compress",
    selectionKind: "wand",
    shapesMode: "shapes",
    stampSubMode: "clone",
    // Eraser / Text / Batch joined the sub-mode axis in the new-ui-toolbar arc
    // (their modes moved out of component state into the store). They must be
    // reset here too or a mode one test selects leaks into the next one's
    // round-trip — the tool's hash now carries its mode.
    eraserMode: "brush",
    textMode: "text",
    batchMode: "logo",
  });
  useUIStore.setState({ settingsOpen: false, settingsTab: "general" });
});

describe("hash -> state", () => {
  it("drives the tool and its sub-mode", () => {
    applyRoute(parseHash("#/tool/paint/blur")!);
    expect(useToolStore.getState().activeTool).toBe("brush");
    expect(useToolStore.getState().brushMode).toBe("blur");
  });

  it("opens the Settings modal on the named pane", () => {
    applyRoute(parseHash("#/settings/security")!);
    expect(useUIStore.getState().settingsOpen).toBe(true);
    expect(useUIStore.getState().settingsTab).toBe("security");
  });

  it("a tool route closes the Settings modal", () => {
    applyRoute({ kind: "settings", tab: "security" });
    applyRoute({ kind: "tool", tool: "brush", mode: "pen" });
    expect(useUIStore.getState().settingsOpen).toBe(false);
    expect(useToolStore.getState().activeTool).toBe("brush");
  });

  it("ignores Batch when there aren't 2+ photos (matches the sidebar gate)", () => {
    // A link must not drop the user into a tool whose own UI says it isn't
    // available — the sidebar disables it and the digit shortcut refuses it.
    applyRoute({ kind: "tool", tool: "emoji" });
    expect(useToolStore.getState().activeTool).toBe("compress");
  });

  it("never writes a sub-mode that isn't one of the tool's own", () => {
    applyRoute({ kind: "tool", tool: "shapes", mode: "erase" }); // Paint's mode
    expect(useToolStore.getState().activeTool).toBe("shapes");
    expect(useToolStore.getState().shapesMode).toBe("shapes"); // untouched
  });

  it("Paint's dead erase route lands on Paint but leaves brushMode untouched", () => {
    // #/tool/paint/erase used to be live; Paint's toggle row is Paint/Blur/Pen
    // now (3 items, was 4) and "erase" is no longer one of Paint's registered
    // modes — a stale/bookmarked link must degrade to the bare tool, not
    // silently poke "erase" into the store.
    useToolStore.setState({ brushMode: "blur" });
    applyRoute(parseHash("#/tool/paint/erase")!);
    expect(useToolStore.getState().activeTool).toBe("brush");
    expect(useToolStore.getState().brushMode).toBe("blur"); // unchanged
  });

  it("the Eraser tool (id 'ai') routes its four sub-modes", () => {
    // Was a known gap: `eraserMode` lived in the store but had no MODE_ACCESS
    // row, so the router could neither read nor write it and every Eraser hash
    // collapsed to the bare tool. The new-ui-toolbar hoist wired it up.
    applyRoute(parseHash("#/tool/eraser/rembg")!);
    expect(useToolStore.getState().activeTool).toBe("ai");
    expect(useToolStore.getState().eraserMode).toBe("rembg");
    expect(currentHash()).toBe("#/tool/eraser/rembg");
  });

  it("never writes an Eraser sub-mode that isn't one of its own", () => {
    useToolStore.setState({ eraserMode: "magic" });
    applyRoute(parseHash("#/tool/eraser/blur")!); // Paint's mode
    expect(useToolStore.getState().activeTool).toBe("ai");
    expect(useToolStore.getState().eraserMode).toBe("magic"); // untouched
  });

  it("the legacy '#/tool/ai' link still resolves to the same tool as '#/tool/eraser'", () => {
    // Display rename AI -> Eraser moved the canonical WRITE slug, but an old
    // bookmark/share link using the pre-rename hash must keep working — same
    // legacy-id-alias mechanism that keeps #/tool/brush resolving for Paint.
    applyRoute(parseHash("#/tool/ai")!);
    expect(useToolStore.getState().activeTool).toBe("ai");
  });

  it("OCR is deep-linkable now that Text's mode lives in the store", () => {
    // Was the counterpart gap to the Eraser one above: TextSettings.tsx held
    // Text/Background/OCR in local useState, so no store field existed for the
    // router to read or write and "#/tool/text/ocr" dropped its mode segment.
    // The hoist moved it to `useToolStore.textMode`, which closes it.
    applyRoute(parseHash("#/tool/text/ocr")!);
    expect(useToolStore.getState().activeTool).toBe("text");
    expect(useToolStore.getState().textMode).toBe("ocr");
    expect(currentHash()).toBe("#/tool/text/ocr");
  });
});

describe("state -> hash", () => {
  it("reports the active tool + sub-mode", () => {
    useToolStore.setState({ activeTool: "brush", brushMode: "blur" });
    expect(currentHash()).toBe("#/tool/paint/blur");
  });

  it("an open Settings modal outranks the tool underneath it", () => {
    useToolStore.setState({ activeTool: "brush", brushMode: "blur" });
    useUIStore.setState({ settingsOpen: true, settingsTab: "rulers" });
    expect(currentHash()).toBe("#/settings/rulers");
    // …and closing it drops back to the tool route, no history hole.
    useUIStore.getState().closeSettings();
    expect(currentHash()).toBe("#/tool/paint/blur");
  });

  it("writes the renamed 'eraser' slug for the ai tool, never the old 'ai' slug", () => {
    useToolStore.setState({ activeTool: "ai", eraserMode: "inpaint" });
    expect(currentHash()).toBe("#/tool/eraser/inpaint");
  });
});

describe("round-trip", () => {
  const hashes = [
    "#/tool/paint/paint",
    "#/tool/paint/blur",
    "#/tool/paint/pen",
    "#/tool/resize/resize",
    "#/tool/select/wand",
    "#/tool/shapes/arrows",
    "#/tool/stamps/emojis",
    // Text and Eraser carry a mode segment now — see the two "was a known gap"
    // tests above. Effects stays bare: it genuinely has no sub-modes.
    "#/tool/text/background",
    "#/tool/eraser/magic",
    "#/tool/effects",
    "#/settings/security",
    "#/settings/superuser",
  ];

  for (const hash of hashes) {
    it(`${hash} -> state -> ${hash}`, () => {
      applyRoute(parseHash(hash)!);
      expect(currentHash()).toBe(hash);
    });
  }

  it("re-applying the current route is a no-op (the loop guard)", () => {
    applyRoute(parseHash("#/tool/paint/blur")!);
    let writes = 0;
    const unsub = useToolStore.subscribe(() => writes++);
    applyRoute(parseHash("#/tool/paint/blur")!); // the hashchange bounce
    unsub();
    // Zero setter calls on a redundant apply: nothing to notify, so the
    // state->hash mirror never fires, so it can't write the hash again. That
    // is what stops hash -> state -> hash from oscillating.
    expect(writes).toBe(0);
    expect(currentHash()).toBe("#/tool/paint/blur");
  });

  it("garbage leaves the app exactly where it was", () => {
    applyRoute(parseHash("#/tool/paint/blur")!);
    const route = parseHash("#/utter/nonsense");
    expect(route).toBeNull(); // -> the mirror re-asserts the canonical hash
    expect(currentHash()).toBe("#/tool/paint/blur");
  });
});

describe("describeRoute", () => {
  it("names the view the way the UI names it", () => {
    expect(describeRoute({ kind: "tool", tool: "brush", mode: "blur" })).toBe(
      "Paint › Blur",
    );
    expect(describeRoute({ kind: "tool", tool: "select", mode: "edge" })).toBe(
      "Select › Edge-aware",
    );
    expect(describeRoute({ kind: "tool", tool: "crop" })).toBe("Adjust");
    expect(describeRoute({ kind: "settings", tab: "security" })).toBe(
      "Settings › Security",
    );
    expect(describeRoute({ kind: "tool", tool: "text" })).toBe("Text");
    // Display renamed AI -> Eraser; describeRoute reads toolConfig.ts's
    // current label, so it must say "Eraser", never the old "AI".
    expect(describeRoute({ kind: "tool", tool: "ai" })).toBe("Eraser");
  });

  it("readRoute describes wherever the app currently is", () => {
    useToolStore.setState({ activeTool: "stamp", stampSubMode: "red" });
    expect(describeRoute(readRoute())).toBe("Stamps › Red Stamps");
  });
});
