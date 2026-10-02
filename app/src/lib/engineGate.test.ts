import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The gate is decided at module load from window.innerWidth and then latches,
// so each case stubs a window and re-imports a fresh copy of the module.
type Gate = typeof import("./engineGate");

function fakeWindow(width: number) {
  const handlers = new Set<() => void>();
  const w = {
    innerWidth: width,
    addEventListener: (_: string, h: () => void) => void handlers.add(h),
    removeEventListener: (_: string, h: () => void) => void handlers.delete(h),
  };
  return {
    w,
    resize: (to: number) => {
      w.innerWidth = to;
      [...handlers].forEach((h) => h());
    },
    listeners: () => handlers.size,
  };
}

async function load(width: number): Promise<{ gate: Gate; win: ReturnType<typeof fakeWindow> }> {
  vi.resetModules();
  const win = fakeWindow(width);
  vi.stubGlobal("window", win.w);
  return { gate: await import("./engineGate"), win };
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("engine gate", () => {
  it("is wanted at desktop width and listens for nothing", async () => {
    const { gate, win } = await load(1280);
    expect(gate.engineWanted()).toBe(true);
    expect(win.listeners()).toBe(0);
  });

  it("is NOT wanted below 600px, and exactly 600 counts as wide", async () => {
    expect((await load(599)).gate.engineWanted()).toBe(false);
    expect((await load(390)).gate.engineWanted()).toBe(false);
    expect((await load(600)).gate.engineWanted()).toBe(true);
  });

  it("whenEngineWanted stays pending on a phone and resolves on widening", async () => {
    const { gate, win } = await load(390);
    let resolved = false;
    void gate.whenEngineWanted().then(() => (resolved = true));
    await Promise.resolve();
    expect(resolved).toBe(false);

    win.resize(500); // still a phone
    await Promise.resolve();
    expect(gate.engineWanted()).toBe(false);
    expect(resolved).toBe(false);

    win.resize(1280);
    await Promise.resolve();
    expect(gate.engineWanted()).toBe(true);
    expect(resolved).toBe(true);
  });

  it("latches: narrowing again never takes the engine back", async () => {
    const { gate, win } = await load(390);
    win.resize(1280);
    win.resize(390);
    expect(gate.engineWanted()).toBe(true);
    expect(win.listeners()).toBe(0); // and the listener is gone
  });

  it("notifies subscribers once, on the flip", async () => {
    const { gate, win } = await load(390);
    const cb = vi.fn();
    gate.subscribeEngineWanted(cb);
    win.resize(400);
    expect(cb).not.toHaveBeenCalled();
    win.resize(900);
    win.resize(1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("loadEngineIfWanted imports nothing on a phone", async () => {
    const init = vi.fn(async () => ({}));
    vi.doMock("stamp_tool", () => ({ default: init }));
    const { gate } = await load(390);
    await gate.loadEngineIfWanted();
    expect(init).not.toHaveBeenCalled();
    vi.doUnmock("stamp_tool");
  });
});
