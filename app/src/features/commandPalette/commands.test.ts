// ===== FILE: app/src/features/commandPalette/commands.test.ts =====
// The registry is the navigation SSOT: Alt+, and a pasted link have to arrive
// at the same place by the same road. These tests pin that — every navigating
// entry lands the app on the route its label promises, and the routing entries
// the status bar advertises actually exist.
import { describe, it, expect, beforeEach } from "vitest";
import { buildPaletteCommands, type PaletteCommand } from "./commands";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { currentHash } from "@/features/routing";

const build = (photoCount = 1) => buildPaletteCommands({ photoCount });
const byId = (cmds: PaletteCommand[], id: string) => cmds.find((c) => c.id === id);

beforeEach(() => {
  useToolStore.setState({
    activeTool: "compress",
    brushMode: "paint",
    adjustMode: "adjust",
    selectionKind: "wand",
    shapesMode: "shapes",
  });
  useUIStore.setState({ settingsOpen: false, settingsTab: "general" });
});

describe("the registry navigates via routes", () => {
  it("a jump-to-tool entry lands on that tool's route", () => {
    byId(build(), "tool.brush")!.run();
    expect(useToolStore.getState().activeTool).toBe("brush");
    expect(currentHash()).toBe("#/tool/paint/paint");
  });

  it("a jump-to-sub-mode entry lands on that sub-mode's route", () => {
    byId(build(), "mode.brush.blur")!.run();
    expect(currentHash()).toBe("#/tool/paint/blur");
  });

  it("a settings entry lands on that pane's route", () => {
    byId(build(), "settings.security")!.run();
    expect(useUIStore.getState().settingsOpen).toBe(true);
    expect(currentHash()).toBe("#/settings/security");
  });

  it("the Eraser (id 'ai') jump-to-tool entry lands on the renamed '#/tool/eraser' route", () => {
    byId(build(), "tool.ai")!.run();
    expect(useToolStore.getState().activeTool).toBe("ai");
    expect(currentHash()).toBe("#/tool/eraser");
  });

  it("every navigating entry produces a route the URL can express", () => {
    // The guarantee behind "one nav path": if an entry moved the app somewhere
    // the grammar can't name, the address bar would quietly go stale.
    const navEntries = build(2).filter(
      (c) => (c.id.startsWith("tool.") || c.id.startsWith("mode.") || c.id.startsWith("settings.")) && !c.disabled,
    );
    expect(navEntries.length).toBeGreaterThan(10);
    for (const cmd of navEntries) {
      if (cmd.id.startsWith("settings.") && !cmd.id.match(/^settings\.(open|security|rulers-pane)$/)) {
        continue; // theme/ruler toggles are settings CHANGES, not navigation
      }
      cmd.run();
      expect(currentHash()).toMatch(/^#\/(tool|settings)\//);
    }
  });
});

describe("sub-mode entries come from the shared table", () => {
  it("covers the registry tools and the not-yet-migrated ones alike", () => {
    const ids = build().map((c) => c.id);
    // Registry modules (Paint / Resize / Adjust & Select)…
    expect(ids).toContain("mode.brush.pen");
    expect(ids).toContain("mode.compress.resize");
    expect(ids).toContain("mode.crop.select");
    // …and the legacy lists (Stamps / Shapes).
    expect(ids).toContain("mode.stamp.emojis");
    expect(ids).toContain("mode.shapes.arrows");
  });

  it("labels a sub-mode with the tool's DISPLAY name, not its legacy id", () => {
    expect(byId(build(), "mode.crop.select")!.label).toBe("Adjust & Select › Select");
    expect(byId(build(), "mode.brush.blur")!.label).toBe("Paint › Blur");
  });

  it("Paint's dead Eraser sub-mode has no palette entry anymore", () => {
    // Paint lost its 4th toggle tile tonight (now Paint/Blur/Pen, was
    // Paint/Blur/Pen/Erase) — a stale "mode.brush.erase" entry would let a
    // user ⌘K their way to a mode the UI no longer offers.
    const ids = build().map((c) => c.id);
    expect(ids).not.toContain("mode.brush.erase");
    const brushModeIds = ids.filter((id) => id.startsWith("mode.brush."));
    expect(brushModeIds.sort()).toEqual(["mode.brush.blur", "mode.brush.paint", "mode.brush.pen"]);
  });
});

describe("the Eraser tool (repurposed 'ai' slot)", () => {
  it("has exactly one jump-to-tool entry, labeled Eraser (not the old 'AI')", () => {
    const cmd = byId(build(), "tool.ai")!;
    expect(cmd.label).toBe("Eraser");
    expect(cmd.shortcut).toBe("6");
  });

  it("has no jump-to-sub-mode entries — AISettings is flat buttons, not a ToolModeToggle", () => {
    // Confirms the brief's suspicion directly: unlike Paint/Shapes/Stamps,
    // the Eraser isn't in TOOL_MODULES and has no LEGACY_SUBMODES row, so
    // allToolModes() never emits a "mode.ai.*" id — a user hunting for
    // "Magic Eraser" or "Background Removal" in the palette will only ever
    // find the one tool-level "Eraser" entry, not a sub-mode for each action.
    const ids = build().map((c) => c.id);
    expect(ids.some((id) => id.startsWith("mode.ai."))).toBe(false);
  });
});

describe("Text's sub-modes are not palette-searchable (known gap, not a regression)", () => {
  // TextSettings.tsx's mode (Text/Background/OCR) is local useState — it was
  // never threaded through useToolStore the way Paint/Shapes/Stamps/Resize/
  // Adjust are, so there's no store field for toolModes.ts's LEGACY_SUBMODES
  // to read even though OCR (new tonight) would otherwise want an entry here.
  // This predates tonight's OCR move (Text/Background already had it) —
  // pinned as current behavior, not fixed, per this pass's scope.
  it("emits no mode.text.* entries at all", () => {
    const ids = build().map((c) => c.id);
    expect(ids.some((id) => id.startsWith("mode.text."))).toBe(false);
  });
});

describe("tool-arc entries since v7.20", () => {
  it("offers the three selection kinds (2.6b)", () => {
    const cmd = byId(build(), "select.edge")!;
    expect(cmd.label).toBe("Adjust & Select › Edge-aware");
    cmd.run();
    // Navigates to the Select sub-mode AND sets the kind — the navigation half
    // still goes through the router.
    expect(currentHash()).toBe("#/tool/adjust/select");
    expect(useToolStore.getState().selectionKind).toBe("edge");
  });

  it("offers the Resize/Compress sub-modes (2.1)", () => {
    expect(byId(build(), "mode.compress.compress")!.label).toBe("Resize › Compress");
  });
});

describe("the routing actions the status bar advertises", () => {
  it("has 'Copy link to this view', findable by the words people type", () => {
    const cmd = byId(build(), "action.copy-link")!;
    expect(cmd.label).toBe("Copy link to this view");
    expect(cmd.group).toBe("actions");
    for (const term of ["copy link", "share", "url", "permalink", "bookmark"]) {
      expect(cmd.keywords).toContain(term);
    }
  });

  it("has 'Go to route…', which keeps the palette open", () => {
    let prompted = false;
    const cmds = buildPaletteCommands({
      photoCount: 1,
      promptRoute: () => {
        prompted = true;
      },
    });
    const cmd = byId(cmds, "action.goto")!;
    expect(cmd.keepOpen).toBe(true); // it hands the palette back to you
    expect(cmd.keywords).toContain("jump");
    cmd.run();
    expect(prompted).toBe(true);
  });

  it("disables Go to route… when the palette hasn't provided the jump box", () => {
    expect(byId(build(), "action.goto")!.disabled).toBe(true);
  });
});
