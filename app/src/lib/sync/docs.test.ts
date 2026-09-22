// The REAL registry: docs.ts, preferences.ts and the two zustand stores, not a
// stand-in document.
//
// syncedDoc.test.ts proves the mechanism on a toy document. These prove the
// three documents the app actually ships are wired to it correctly — which is
// where the first-commit bug lived: the mechanism was fine, and the one real
// document without a ready gate was never primed. The old tests primed their
// toy documents by hand and so could not see it.
//
// Two "tabs" are two module graphs (vi.resetModules), sharing one
// localStorage (the ledger, the preferences blob) and one fake IndexedDB (the
// zustand stores) the way two tabs of one browser profile do.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
}

async function openTab() {
  vi.resetModules();
  const [docs, prefs, ui, tools, ledger, channel] = await Promise.all([
    import("@/lib/sync/docs"),
    import("@/lib/preferences"),
    import("@/stores/useUIStore"),
    import("@/stores/useToolStore"),
    import("@/lib/sync/ledger"),
    import("@/lib/sync/channel"),
  ]);
  const byKey = (key: string) => docs.SYNCED_DOCS.find((d) => d.key === key)!;
  // Wait for both stores to hydrate and their bridges to attach.
  await Promise.all(docs.SYNCED_DOCS.map((d) => d.whenReady()));
  await settle();
  return {
    prefs,
    ui: ui.useUIStore,
    tools: tools.useToolStore,
    ledger,
    prefsDoc: byKey("prefs"),
    uiDoc: byKey("ui"),
    toolsDoc: byKey("tools"),
    close: () => channel.closeChannelForTests(),
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

let closers: (() => void)[] = [];

beforeEach(() => {
  closers = [];
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
  for (const close of closers) close();
  vi.unstubAllGlobals();
});

describe("prefs, through the real registry (finding 1)", () => {
  it("sends the FIRST preference change in a tab to the other tab, and records it as owed", async () => {
    const a = await openTab();
    const b = await openTab();
    closers = [a.close, b.close];
    a.ledger.setCurrentAccount("acct-a");

    // A user edit, by the same function Settings' Apply calls.
    a.prefs.commitPreferences({ ...a.prefs.readPreferences(), theme: "light" });
    await settle();

    expect(b.prefs.readPreferences().theme).toBe("light");
    expect(a.prefsDoc.snapshot().dirty).toBe(true);
    expect(JSON.parse(a.prefsDoc.snapshot().value).theme).toBe("light");
  });

  it("adopting from the other tab is not an edit there", async () => {
    const a = await openTab();
    const b = await openTab();
    closers = [a.close, b.close];
    a.ledger.setCurrentAccount("acct-a");
    a.prefsDoc.markIdle(4); // both tabs have synced to rev 4
    a.prefs.commitPreferences({ ...a.prefs.readPreferences(), rulers: true });
    await settle();

    // B adopted it; the obligation is A's change, recorded once, not a second
    // change B made by adopting.
    expect(b.prefs.readPreferences().rulers).toBe(true);
    expect(b.prefsDoc.snapshot()).toMatchObject({ dirty: true, rev: 4 });
    expect(b.prefsDoc.snapshot().updatedAt).toBe(a.prefsDoc.snapshot().updatedAt);
  });
});

describe("the online-features switch is consent, and stays on this device (finding 11)", () => {
  it("is not part of the ui document", async () => {
    const a = await openTab();
    closers = [a.close];
    expect(Object.keys(JSON.parse(a.uiDoc.snapshot().value))).not.toContain(
      "onlineFeaturesEnabled",
    );
  });

  it("does not reach another tab or become owed to the account when switched", async () => {
    const a = await openTab();
    const b = await openTab();
    closers = [a.close, b.close];
    a.ledger.setCurrentAccount("acct-a");

    a.ui.getState().setOnlineFeaturesEnabled(true);
    await settle();

    expect(a.uiDoc.snapshot().dirty).toBe(false);
    expect(b.ui.getState().onlineFeaturesEnabled).toBe(false);
  });
});

describe("navigation from another device waits for the next load (finding 12)", () => {
  function toolsBlob(over: Record<string, unknown>) {
    return JSON.stringify({
      brushMode: "paint",
      stampSubMode: "clone",
      shapesMode: "shapes",
      eraserMode: "brush",
      textMode: "text",
      batchMode: "logo",
      exportFormat: "jpeg",
      quality: 75,
      ...over,
    });
  }

  it("does not switch the running session's eraser mode, but does apply the export preference", async () => {
    const a = await openTab();
    closers = [a.close];
    a.ledger.setCurrentAccount("acct-a");
    expect(a.tools.getState().eraserMode).toBe("brush");

    a.toolsDoc.applyRemote(toolsBlob({ eraserMode: "magic", exportFormat: "webp" }), 3, {
      live: true,
    });

    // The phone's eraser choice is NOT under the laptop's next stroke…
    expect(a.tools.getState().eraserMode).toBe("brush");
    // …but a preference read at export time is applied like any other setting.
    expect(a.tools.getState().exportFormat).toBe("webp");
    // The document still reports the phone's choice, so nothing here reverts it.
    expect(JSON.parse(a.toolsDoc.snapshot().value).eraserMode).toBe("magic");
    expect(a.toolsDoc.snapshot().dirty).toBe(false);
  });

  it("applies it at load (live: false)", async () => {
    const a = await openTab();
    closers = [a.close];
    a.toolsDoc.applyRemote(toolsBlob({ eraserMode: "magic" }), 3, { live: false });
    expect(a.tools.getState().eraserMode).toBe("magic");
  });

  it("carries the held choice in this tab's next push instead of reverting the other device", async () => {
    const a = await openTab();
    closers = [a.close];
    a.ledger.setCurrentAccount("acct-a");
    a.toolsDoc.applyRemote(toolsBlob({ eraserMode: "magic" }), 3, { live: true });

    a.tools.getState().setBrushMode("blur"); // an unrelated edit here
    const sent = JSON.parse(a.toolsDoc.snapshot().value);
    expect(sent).toMatchObject({ brushMode: "blur", eraserMode: "magic" });
    expect(a.toolsDoc.snapshot().dirty).toBe(true);
  });

  it("lets go of a held field the moment the user changes it here", async () => {
    const a = await openTab();
    closers = [a.close];
    a.toolsDoc.applyRemote(toolsBlob({ eraserMode: "magic" }), 3, { live: true });
    a.tools.getState().setEraserMode("inpaint");
    expect(JSON.parse(a.toolsDoc.snapshot().value).eraserMode).toBe("inpaint");
  });

  it("holds the master-bar tab too, and applies the palette history live", async () => {
    const a = await openTab();
    closers = [a.close];
    const blob = JSON.stringify({
      masterTab: "gallery",
      recentCommands: ["theme.toggle"],
      commandUsage: { "theme.toggle": 3 },
    });
    a.uiDoc.applyRemote(blob, 2, { live: true });
    expect(a.ui.getState().masterTab).toBe("tools");
    expect(a.ui.getState().recentCommands).toEqual(["theme.toggle"]);
  });
});
