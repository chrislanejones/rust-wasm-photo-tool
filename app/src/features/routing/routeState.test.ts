// ===== FILE: app/src/features/routing/routeState.test.ts =====
// The grammar tests (routes.test.ts) pin the string contract. These pin the
// STATE contract against the real Zustand stores: a hash drives the app to the
// view it names, the app reports the hash it's at, and the two agree — which
// is exactly the property the URL<->state mirror's loop guard rests on.
//
// Since v7.51 a tool route names a SUB-TOOL, and applying one goes through
// `activateSubTool` — the same call the rail and the palette make — so these
// also pin that a link and a click leave the app in the same state.
import { describe, it, expect, beforeEach } from "vitest";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { applyRoute, currentHash, parseHash, readRoute, describeRoute } from "./routeState";
import { LIVE_SUB_TOOLS } from "@/features/tools/toolGroups";

beforeEach(() => {
  useToolStore.setState({
    activeTool: "compress",
    activeSubTool: "enhance/compress",
    brushMode: "paint",
    resizeMode: "compress",
    selectionKind: "wand",
    shapesMode: "shapes",
    stampSubMode: "clone",
    eraserMode: "brush",
    textMode: "text",
    batchMode: "logo",
    colorPickerActive: false,
  });
  useUIStore.setState({ settingsOpen: false, settingsTab: "general" });
});

const apply = (hash: string) => {
  const r = parseHash(hash);
  if (r) applyRoute(r);
  return r;
};

describe("hash -> state", () => {
  it("drives the tool AND its sub-mode from a sub-tool route", () => {
    apply("#/create/blur-brush");
    expect(useToolStore.getState().activeTool).toBe("brush");
    expect(useToolStore.getState().brushMode).toBe("blur");
    expect(useToolStore.getState().activeSubTool).toBe("create/blur-brush");
  });

  it("opens the Settings modal on the named pane", () => {
    apply("#/settings/security");
    expect(useUIStore.getState().settingsOpen).toBe(true);
    expect(useUIStore.getState().settingsTab).toBe("security");
  });

  it("a tool route closes the Settings modal", () => {
    useUIStore.setState({ settingsOpen: true, settingsTab: "security" });
    apply("#/create/brush");
    expect(useUIStore.getState().settingsOpen).toBe(false);
  });

  it("ignores Batch when there aren't 2+ photos (matches the rail gate)", () => {
    useGalleryStore.setState({ photos: [] });
    apply("#/batch/logo");
    expect(useToolStore.getState().activeTool).toBe("compress");
  });

  it("the three Edit sub-tools sharing `crop` each set their own lit tile", () => {
    apply("#/edit/transform");
    expect(useToolStore.getState().activeSubTool).toBe("edit/transform");
    apply("#/edit/color-picker");
    expect(useToolStore.getState().activeSubTool).toBe("edit/color-picker");
    // …and Color Picker arms the eyedropper, exactly as clicking the tile does.
    expect(useToolStore.getState().colorPickerActive).toBe(true);
    apply("#/edit/crop");
    expect(useToolStore.getState().colorPickerActive).toBe(false);
  });

  it("a legacy link lands on the same state as the new form", () => {
    apply("#/tool/paint/blur");
    const legacy = { ...useToolStore.getState() };
    apply("#/enhance/compress"); // move away
    apply("#/create/blur-brush");
    const modern = useToolStore.getState();
    expect(modern.activeTool).toBe(legacy.activeTool);
    expect(modern.brushMode).toBe(legacy.brushMode);
    expect(modern.activeSubTool).toBe(legacy.activeSubTool);
  });

  it("a Coming Soon route never activates anything", () => {
    // Ruler, not Perspective: Perspective SHIPPED in v8.42 and is now a live
    // sub-tool with its own ToolType, so it stopped being an example of this
    // property. The property itself is unchanged — a Coming Soon entry carries
    // no `tool` by type, so applyRoute has nothing to activate.
    //
    // ⚠️ Ruler is now the ONLY Coming Soon sub-tool in the registry. When it
    // ships, this test (and the two below it in routes.test.ts and
    // commands.test.ts) needs a new exemplar or a deliberate deletion — do not
    // just delete the assertion and leave the property untested.
    apply("#/edit/ruler"); // parses to the group default, not ruler
    expect(useToolStore.getState().activeSubTool).toBe("edit/crop");
  });

  it("OCR is deep-linkable", () => {
    apply("#/create/ocr");
    expect(useToolStore.getState().activeTool).toBe("text");
    expect(useToolStore.getState().textMode).toBe("ocr");
  });
});

describe("state -> hash", () => {
  it("reports the lit sub-tool", () => {
    apply("#/create/blur-brush");
    expect(currentHash()).toBe("#/create/blur-brush");
  });

  it("an open Settings modal outranks the tool underneath it", () => {
    apply("#/create/brush");
    useUIStore.setState({ settingsOpen: true, settingsTab: "billing" });
    expect(currentHash()).toBe("#/settings/billing");
  });

  it("re-derives the sub-tool when the stored key is stale", () => {
    // Simulates a reload (activeSubTool isn't persisted) or a panel's own mode
    // toggle: the (tool, mode) pair is the truth and the key must yield to it.
    useToolStore.setState({
      activeTool: "brush",
      brushMode: "pen",
      activeSubTool: "enhance/compress",
    });
    expect(currentHash()).toBe("#/create/pen");
  });
});

describe("round-trip", () => {
  it("hash -> state -> hash is identity for every live sub-tool", () => {
    useGalleryStore.setState({ photos: [{ id: "a" }, { id: "b" }] as never });
    for (const { group, subTool } of LIVE_SUB_TOOLS) {
      const hash = `#/${group.id}/${subTool.id}`;
      apply(hash);
      expect(currentHash()).toBe(hash);
    }
  });

  it("re-applying the current route is a no-op (the loop guard)", () => {
    apply("#/create/brush");
    const before = JSON.stringify(useToolStore.getState().activeSubTool);
    applyRoute(readRoute());
    expect(JSON.stringify(useToolStore.getState().activeSubTool)).toBe(before);
    expect(currentHash()).toBe("#/create/brush");
  });

  it("garbage leaves the app exactly where it was", () => {
    apply("#/create/brush");
    const before = currentHash();
    apply("#/nonsense/nothing");
    expect(currentHash()).toBe(before);
  });
});

describe("describeRoute", () => {
  it("names a sub-tool route the way the palette does", () => {
    expect(
      describeRoute({ kind: "tool", group: "create", subTool: "brush" }),
    ).toBe("Create › Brush");
  });

  it("names a settings route", () => {
    expect(describeRoute({ kind: "settings", tab: "security" })).toBe(
      "Settings › Security",
    );
  });
});
