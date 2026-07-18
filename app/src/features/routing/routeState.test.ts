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
    adjustMode: "adjust",
    shapesMode: "shapes",
    stampSubMode: "clone",
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

  it("the Eraser tool (id 'ai') has no sub-mode route — it's flat buttons, not a ToolModeToggle", () => {
    applyRoute(parseHash("#/tool/eraser")!);
    expect(useToolStore.getState().activeTool).toBe("ai");
    // A mode segment on the Eraser's URL isn't validated against anything
    // (no registry/legacy sub-mode list exists for "ai") — it's just dropped.
    applyRoute(parseHash("#/tool/eraser/brush")!);
    expect(useToolStore.getState().activeTool).toBe("ai");
    expect(currentHash()).toBe("#/tool/eraser");
  });

  it("the legacy '#/tool/ai' link still resolves to the same tool as '#/tool/eraser'", () => {
    // Display rename AI -> Eraser moved the canonical WRITE slug, but an old
    // bookmark/share link using the pre-rename hash must keep working — same
    // legacy-id-alias mechanism that keeps #/tool/brush resolving for Paint.
    applyRoute(parseHash("#/tool/ai")!);
    expect(useToolStore.getState().activeTool).toBe("ai");
  });

  it("OCR is not (yet) part of the routing system — Text has no sub-mode table entry", () => {
    // TextSettings.tsx's mode (Text/Background/OCR) is local useState, never
    // synced through useToolStore the way Paint/Shapes/Stamps/Resize/Adjust
    // are — so there is no store field for the router to read or write, and
    // an OCR-shaped hash can't select anything. This pins CURRENT behavior,
    // not the ideal: a hand-typed "#/tool/text/ocr" silently drops the mode
    // segment and just lands on bare Text.
    applyRoute(parseHash("#/tool/text/ocr")!);
    expect(useToolStore.getState().activeTool).toBe("text");
    expect(currentHash()).toBe("#/tool/text");
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
    useToolStore.setState({ activeTool: "ai" });
    expect(currentHash()).toBe("#/tool/eraser");
  });
});

describe("round-trip", () => {
  const hashes = [
    "#/tool/paint/paint",
    "#/tool/paint/blur",
    "#/tool/paint/pen",
    "#/tool/resize/resize",
    "#/tool/adjust/select",
    "#/tool/shapes/arrows",
    "#/tool/stamps/emojis",
    "#/tool/text",
    "#/tool/eraser",
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
    expect(describeRoute({ kind: "tool", tool: "crop", mode: "select" })).toBe(
      "Adjust & Select › Select",
    );
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
