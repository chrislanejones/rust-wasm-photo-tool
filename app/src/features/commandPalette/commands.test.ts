// ===== FILE: app/src/features/commandPalette/commands.test.ts =====
// The registry is the navigation SSOT: Alt+, and a pasted link have to arrive
// at the same place by the same road. These tests pin that — every navigating
// entry lands the app on the route its label promises, and the routing entries
// the status bar advertises actually exist.
//
// Since v7.51 the palette speaks GROUPS and SUB-TOOLS, built from
// `toolGroups.ts`. It used to walk `TOOLS` plus the sub-mode table, which meant
// it spoke in legacy tool names and printed the tool's label twice for any tool
// whose first mode shared its name — the "Paint › Paint" row.
import { describe, it, expect, beforeEach } from "vitest";
import { buildPaletteCommands, type PaletteCommand } from "./commands";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { currentHash } from "@/features/routing";
import { LIVE_SUB_TOOLS, TOOL_GROUPS } from "@/features/tools/toolGroups";

const build = (photoCount = 1) => buildPaletteCommands({ photoCount });
const byId = (cmds: PaletteCommand[], id: string) => cmds.find((c) => c.id === id);

beforeEach(() => {
  useToolStore.setState({
    activeTool: "compress",
    activeSubTool: "enhance/compress",
    brushMode: "paint",
    resizeMode: "compress",
    selectionKind: "wand",
    shapesMode: "shapes",
    eraserMode: "brush",
    textMode: "text",
    stampSubMode: "clone",
    batchMode: "logo",
    colorPickerActive: false,
  });
  useUIStore.setState({ settingsOpen: false, settingsTab: "general" });
});

describe("the registry navigates via routes", () => {
  it("a jump-to-GROUP entry lands on that group's first live sub-tool", () => {
    byId(build(), "group.create")!.run();
    expect(useToolStore.getState().activeTool).toBe("brush");
    expect(currentHash()).toBe("#/create/brush");
  });

  it("a jump-to-SUB-TOOL entry lands on that sub-tool's route", () => {
    byId(build(), "sub.create.blur-brush")!.run();
    expect(useToolStore.getState().activeTool).toBe("brush");
    expect(useToolStore.getState().brushMode).toBe("blur");
    expect(currentHash()).toBe("#/create/blur-brush");
  });

  it("a settings entry lands on that pane's route", () => {
    byId(build(), "settings.security")!.run();
    expect(currentHash()).toBe("#/settings/security");
  });

  it("the three Edit sub-tools sharing `crop` get THREE distinct routes", () => {
    // The old grammar collapsed these onto one URL, so the palette could offer
    // three rows that all went to the same place.
    const cmds = build();
    const hashes = ["crop", "transform", "color-picker"].map((id) => {
      byId(cmds, `sub.edit.${id}`)!.run();
      return currentHash();
    });
    expect(hashes).toEqual(["#/edit/crop", "#/edit/transform", "#/edit/color-picker"]);
    expect(new Set(hashes).size).toBe(3);
  });

  it("every navigating entry produces a route the URL can express", () => {
    const cmds = build(2).filter(
      (c) => c.group === "tools" && !c.disabled,
    );
    expect(cmds.length).toBeGreaterThan(0);
    for (const cmd of cmds) {
      cmd.run();
      const hash = currentHash();
      expect(hash.startsWith("#/")).toBe(true);
      expect(hash).not.toContain("undefined");
    }
  });
});

describe("entries come from the group registry", () => {
  it("emits exactly one entry per group", () => {
    const cmds = build(2);
    for (const group of TOOL_GROUPS) {
      expect(byId(cmds, `group.${group.id}`)).toBeDefined();
    }
    expect(cmds.filter((c) => c.id.startsWith("group.")).length).toBe(
      TOOL_GROUPS.length,
    );
  });

  it("emits exactly one entry per LIVE sub-tool", () => {
    const cmds = build(2);
    for (const { group, subTool } of LIVE_SUB_TOOLS) {
      expect(byId(cmds, `sub.${group.id}.${subTool.id}`)).toBeDefined();
    }
    expect(cmds.filter((c) => c.id.startsWith("sub.")).length).toBe(
      LIVE_SUB_TOOLS.length,
    );
  });

  it("labels a sub-tool 'Group › Sub-tool', never the legacy tool name", () => {
    const cmds = build();
    expect(byId(cmds, "sub.create.brush")!.label).toBe("Create › Brush");
    expect(byId(cmds, "sub.enhance.compress")!.label).toBe("Enhance › Compress");
    // The regression this replaces: the old loop produced "Paint › Paint".
    expect(cmds.some((c) => c.label === "Paint › Paint")).toBe(false);
    expect(cmds.some((c) => /^(\w+) › \1$/.test(c.label))).toBe(false);
  });

  it("offers no entry for a Coming Soon sub-tool", () => {
    const cmds = build(2);
    expect(byId(cmds, "sub.edit.perspective")).toBeUndefined();
    expect(byId(cmds, "sub.edit.ruler")).toBeUndefined();
  });

  it("no entry speaks a legacy tool id in its own id", () => {
    // Guards the drift back: ids are group/sub-tool now.
    const cmds = build(2).filter((c) => c.group === "tools");
    for (const c of cmds) {
      expect(c.id).toMatch(/^(group|sub)\./);
    }
  });
});

describe("Batch gating matches the rail and the router", () => {
  it("Batch entries are disabled with fewer than 2 photos", () => {
    const one = build(1);
    expect(byId(one, "group.batch")!.disabled).toBe(true);
    expect(byId(one, "sub.batch.logo")!.disabled).toBe(true);
  });

  it("…and enabled once there are 2+", () => {
    const two = build(2);
    expect(byId(two, "group.batch")!.disabled).toBe(false);
    expect(byId(two, "sub.batch.logo")!.disabled).toBe(false);
  });
});

describe("sub-tools that were previously unreachable", () => {
  it("OCR is a first-class entry now", () => {
    byId(build(), "sub.create.ocr")!.run();
    expect(useToolStore.getState().activeTool).toBe("text");
    expect(useToolStore.getState().textMode).toBe("ocr");
    expect(currentHash()).toBe("#/create/ocr");
  });

  it("Magic Eraser selects its mode as well as navigating", () => {
    byId(build(), "sub.create.magic-eraser")!.run();
    expect(useToolStore.getState().activeTool).toBe("ai");
    expect(useToolStore.getState().eraserMode).toBe("magic");
  });

  it("Color Picker arms the eyedropper, the way the rail tile does", () => {
    byId(build(), "sub.edit.color-picker")!.run();
    expect(useToolStore.getState().colorPickerActive).toBe(true);
  });

  it("…and moving to another Edit sub-tool disarms it again", () => {
    const cmds = build();
    byId(cmds, "sub.edit.color-picker")!.run();
    byId(cmds, "sub.edit.crop")!.run();
    expect(useToolStore.getState().colorPickerActive).toBe(false);
  });
});
