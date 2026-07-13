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
});

describe("state -> hash", () => {
  it("reports the active tool + sub-mode", () => {
    useToolStore.setState({ activeTool: "brush", brushMode: "erase" });
    expect(currentHash()).toBe("#/tool/paint/erase");
  });

  it("an open Settings modal outranks the tool underneath it", () => {
    useToolStore.setState({ activeTool: "brush", brushMode: "erase" });
    useUIStore.setState({ settingsOpen: true, settingsTab: "rulers" });
    expect(currentHash()).toBe("#/settings/rulers");
    // …and closing it drops back to the tool route, no history hole.
    useUIStore.getState().closeSettings();
    expect(currentHash()).toBe("#/tool/paint/erase");
  });
});

describe("round-trip", () => {
  const hashes = [
    "#/tool/paint/blur",
    "#/tool/paint/erase",
    "#/tool/resize/resize",
    "#/tool/adjust/select",
    "#/tool/shapes/arrows",
    "#/tool/stamps/emojis",
    "#/tool/text",
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
  });

  it("readRoute describes wherever the app currently is", () => {
    useToolStore.setState({ activeTool: "stamp", stampSubMode: "red" });
    expect(describeRoute(readRoute())).toBe("Stamps › Red Stamps");
  });
});
