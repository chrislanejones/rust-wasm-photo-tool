// The "Everything in your browser" switch gates every sub-tool that sends the
// image to a server — the ones toolGroups.ts flags `requiresNetwork`. These pin
// the three places it is enforced (activation, the switch-off move, the
// palette) against the real stores, with a positive and a negative case each.
import { describe, it, expect, beforeEach } from "vitest";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { activateSubTool, isBlockedOffline } from "./activateSubTool";
import { LIVE_SUB_TOOLS, resolveSubTool } from "./toolGroups";
import { buildPaletteCommands } from "@/features/commandPalette/commands";

const ai = () => resolveSubTool("enhance", "ai")!;
const ocr = () => resolveSubTool("create", "ocr")!;
const brush = () => resolveSubTool("create", "brush")!;

beforeEach(() => {
  useUIStore.setState({ onlineFeaturesEnabled: false });
  useToolStore.setState({
    activeTool: "brush",
    activeSubTool: "create/brush",
    brushMode: "paint",
    eraserMode: "brush",
    textMode: "text",
    colorPickerActive: false,
  });
});

describe("which sub-tools the switch gates", () => {
  it("is exactly the requiresNetwork set, and it is not empty", () => {
    const gated = LIVE_SUB_TOOLS.filter((r) => isBlockedOffline(r.subTool, false));
    expect(gated.map((r) => r.key).sort()).toEqual(["create/ocr", "enhance/ai"]);
  });

  it("gates nothing when online features are on", () => {
    expect(LIVE_SUB_TOOLS.some((r) => isBlockedOffline(r.subTool, true))).toBe(false);
  });
});

describe("activation", () => {
  it("refuses Enhance › AI and OCR while the switch is off", () => {
    activateSubTool(ai());
    expect(useToolStore.getState().activeTool).toBe("brush");
    activateSubTool(ocr());
    expect(useToolStore.getState().activeTool).toBe("brush");
  });

  it("allows them once the switch is on", () => {
    useUIStore.setState({ onlineFeaturesEnabled: true });
    activateSubTool(ai());
    expect(useToolStore.getState().activeTool).toBe("ai");
    expect(useToolStore.getState().eraserMode).toBe("rembg");
  });

  it("never blocks a local tool", () => {
    useToolStore.setState({ activeTool: "compress", activeSubTool: "enhance/compress" });
    activateSubTool(brush());
    expect(useToolStore.getState().activeTool).toBe("brush");
  });
});

describe("turning the switch off", () => {
  it("moves off a lit server-backed sub-tool to its group's first tool", () => {
    useUIStore.setState({ onlineFeaturesEnabled: true });
    activateSubTool(ai());
    useUIStore.getState().setOnlineFeaturesEnabled(false);
    expect(useToolStore.getState().activeTool).toBe("compress");
    expect(useToolStore.getState().activeSubTool).toBe("enhance/compress");
  });

  it("leaves a local tool alone", () => {
    useUIStore.setState({ onlineFeaturesEnabled: true });
    activateSubTool(brush());
    useUIStore.getState().setOnlineFeaturesEnabled(false);
    expect(useToolStore.getState().activeTool).toBe("brush");
  });
});

describe("command palette", () => {
  const entry = (online: boolean | undefined, id: string) =>
    buildPaletteCommands({ photoCount: 1, onlineFeatures: online }).find((c) => c.id === id)!;

  it("disables server-backed entries while off, and when the flag is absent", () => {
    expect(entry(false, "sub.enhance.ai").disabled).toBe(true);
    expect(entry(false, "sub.create.ocr").disabled).toBe(true);
    expect(entry(undefined, "sub.enhance.ai").disabled).toBe(true);
  });

  it("enables them when on, and never disables a local entry for this", () => {
    expect(entry(true, "sub.enhance.ai").disabled).toBe(false);
    expect(entry(true, "sub.create.ocr").disabled).toBe(false);
    expect(entry(false, "sub.create.brush").disabled).toBe(false);
  });
});
