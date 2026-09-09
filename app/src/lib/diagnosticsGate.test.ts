// The per-frame diagnostics gate.
//
// What this pins is a COST, not a behaviour — the app renders identically
// whether or not these instruments are collected, which is exactly why the
// regression would be silent. `flushToCanvas` published the tile-dirty count
// and the op-log stats on every frame for a window that is closed almost
// always: ~14 engine calls, one of them a full-image composite diff, and behind
// the engine worker every one a postMessage round trip.
//
// So the assertions below are about WHETHER WORK RAN, and the "listening"
// direction matters as much as the "not listening" one — a gate that never
// opens would leave the Diagnostics window permanently blank, which is the
// failure a careless fix produces.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  collectIfDiagnosticsListening,
  diagnosticsListening,
  registerDiagnosticsResample,
  setDiagnosticsListening,
} from "./resourceMonitor";

beforeEach(() => {
  setDiagnosticsListening(false);
  registerDiagnosticsResample(null);
});

describe("collectIfDiagnosticsListening", () => {
  it("does NOT collect while nothing is reading — the whole point", () => {
    const collect = vi.fn();
    collectIfDiagnosticsListening(collect);
    expect(collect).not.toHaveBeenCalled();
  });

  it("DOES collect while the window is open", () => {
    setDiagnosticsListening(true);
    const collect = vi.fn();
    collectIfDiagnosticsListening(collect);
    expect(collect).toHaveBeenCalledTimes(1);
  });

  it("stops again when the window closes", () => {
    setDiagnosticsListening(true);
    setDiagnosticsListening(false);
    const collect = vi.fn();
    collectIfDiagnosticsListening(collect);
    expect(collect).not.toHaveBeenCalled();
  });
});

describe("sampling on open", () => {
  // Without this the panel shows whatever the last edit left behind — or
  // nothing at all, if the user opens it without drawing.
  it("resamples once on the false -> true edge", () => {
    const resample = vi.fn();
    registerDiagnosticsResample(resample);
    setDiagnosticsListening(true);
    expect(resample).toHaveBeenCalledTimes(1);
  });

  it("does not resample on a repeated true, or on closing", () => {
    const resample = vi.fn();
    registerDiagnosticsResample(resample);
    setDiagnosticsListening(true);
    resample.mockClear();
    setDiagnosticsListening(true); // still open, e.g. an effect re-run
    setDiagnosticsListening(false);
    expect(resample).not.toHaveBeenCalled();
  });

  it("survives having no collector registered", () => {
    // `useEngineCore` unregisters on unmount, and the window can outlive it.
    registerDiagnosticsResample(null);
    expect(() => setDiagnosticsListening(true)).not.toThrow();
  });
});

describe("diagnosticsListening", () => {
  it("reports the flag both ways", () => {
    expect(diagnosticsListening()).toBe(false);
    setDiagnosticsListening(true);
    expect(diagnosticsListening()).toBe(true);
  });
});
