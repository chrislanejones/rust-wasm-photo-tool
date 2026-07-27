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
    selectionKind: "wand",
    textMode: "text",
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

  it("the Eraser (id 'ai') jump-to-tool entry lands on the renamed 'eraser' route", () => {
    useToolStore.setState({ eraserMode: "brush" });
    byId(build(), "tool.ai")!.run();
    expect(useToolStore.getState().activeTool).toBe("ai");
    // Carries its sub-mode now that `eraserMode` is on the sub-mode axis.
    expect(currentHash()).toBe("#/tool/eraser/brush");
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
    // Registry modules (Paint / Resize / Select)…
    expect(ids).toContain("mode.brush.pen");
    expect(ids).toContain("mode.compress.resize");
    expect(ids).toContain("mode.select.wand");
    // …and the legacy lists (Stamps). Shapes stopped being a tool in v7.51 —
    // its modes are Vector's now, asserted in the Vector block below.
    expect(ids).toContain("mode.stamp.emojis");
    expect(ids).not.toContain("mode.shapes.arrows");
  });

  it("emits no mode.crop.* entries — Adjust is single-mode since the Select split", () => {
    const ids = build().map((c) => c.id);
    expect(ids.some((id) => id.startsWith("mode.crop."))).toBe(false);
  });

  it("labels a sub-mode with the tool's DISPLAY name, not its legacy id", () => {
    expect(byId(build(), "mode.select.edge")!.label).toBe("Select › Edge-aware");
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
    // 7, not 6: the rail renumbered in reading order when Select took a digit.
    expect(cmd.shortcut).toBe("7");
  });

  it("offers all four of its sub-modes as jump-to entries", () => {
    // Was the reverse assertion: the Eraser had no LEGACY_SUBMODES row, so
    // allToolModes() emitted no "mode.ai.*" ids and a user hunting for "Magic
    // Eraser" or "Background Removal" found only the one tool-level entry.
    // The new-ui-toolbar arc gave `ai` a row (its tiles had to come from
    // somewhere), and the palette picks it up off the same table.
    const ids = build().map((c) => c.id);
    for (const m of ["brush", "magic", "rembg", "inpaint"]) {
      expect(ids).toContain(`mode.ai.${m}`);
    }
  });

  it("a sub-mode entry both navigates and selects the mode", () => {
    const cmd = byId(build(), "mode.ai.magic")!;
    expect(cmd.label).toBe("Eraser › Magic Eraser");
    cmd.run();
    expect(useToolStore.getState().activeTool).toBe("ai");
    expect(useToolStore.getState().eraserMode).toBe("magic");
    expect(currentHash()).toBe("#/tool/eraser/magic");
  });
});

describe("Vector's sub-modes are palette-searchable (the gap closed in new-ui-toolbar)", () => {
  // TextSettings.tsx held its mode (Text/Background/OCR) in local useState, so
  // there was no store field for toolModes.ts to read and the palette emitted
  // no mode.text.* entries at all — OCR in particular was unreachable by
  // search. The hoist moved it to `useToolStore.textMode`, which fixes it.
  // v7.51 folded Shapes into this tool and renamed the pair "Vector", so the
  // palette is now the only place some of these are reachable by name — the
  // rail lost four tiles' worth of labels when Shapes went away.
  it("emits one entry per Vector sub-mode", () => {
    const ids = build().map((c) => c.id);
    for (const m of ["text", "ocr", "shapes", "pens", "arrow", "line"]) {
      expect(ids).toContain(`mode.text.${m}`);
    }
  });

  // Background stopped being a mode and became a section of the Text panel.
  it("no longer offers Background as a mode", () => {
    expect(build().map((c) => c.id)).not.toContain("mode.text.background");
  });

  it("a drawing sub-mode lands on the Vector tool, not the retired Shapes one", () => {
    const cmd = byId(build(), "mode.text.arrow")!;
    cmd.run();
    expect(useToolStore.getState().activeTool).toBe("text");
    expect(useToolStore.getState().textMode).toBe("arrow");
    expect(currentHash()).toBe("#/tool/text/arrow");
  });

  it("OCR is reachable and selects the mode", () => {
    const cmd = byId(build(), "mode.text.ocr")!;
    expect(cmd.label).toBe("Vector › OCR");
    cmd.run();
    expect(useToolStore.getState().activeTool).toBe("text");
    expect(useToolStore.getState().textMode).toBe("ocr");
    expect(currentHash()).toBe("#/tool/text/ocr");
  });
});

describe("tool-arc entries since v7.20", () => {
  it("offers the selection kinds as real routes (Select is its own tool)", () => {
    // Was a hand-rolled `select.edge` entry that navigated to the old
    // `#/tool/adjust/select` and set the kind imperatively; the kinds are the
    // Select TOOL's registry sub-modes now, so the generic mode.* loop emits
    // them and the kind rides in the route itself.
    const cmd = byId(build(), "mode.select.edge")!;
    expect(cmd.label).toBe("Select › Edge-aware");
    cmd.run();
    expect(currentHash()).toBe("#/tool/select/edge");
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
