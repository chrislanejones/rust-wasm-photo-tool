// app/src/lib/resourceMonitor.ts
//
// A tiny, htop-style resource sampler feeding the "Resources" tab of the
// Alt+Delete diagnostics overlay. It reports what the app is actually spending
// the machine on: main-thread frame load (FPS), JS heap, the WASM engine's
// linear memory (where the image buffers live), and a per-subsystem "process
// list" derived from the diagnostics ring buffer.
//
// Everything is read live and in-memory only; nothing is persisted or sent.

import { useEffect, useRef, useState } from "react";
import { getDiagnostics, type LogSource } from "./diagnosticsLog";

// ── WASM memory handle ───────────────────────────────────────────────────────
// useCloneStamp registers the engine's WebAssembly.Memory here whenever it
// (re)initializes the module, so the monitor can read the live buffer size
// without owning a second wasm instance.
let wasmMemory: WebAssembly.Memory | null = null;

export function registerWasmMemory(mem: WebAssembly.Memory): void {
  wasmMemory = mem;
}

// ── Off-heap memory probes ───────────────────────────────────────────────────
// performance.memory only sees the JS heap, and a WebAssembly.Memory only its
// own linear buffer. The browser's per-tab footprint additionally includes
// canvas backing stores, decoded images, and worker heaps — the bulk of a photo
// editor's memory. These two probes recover what we can: a true whole-tab total
// (when cross-origin isolated) and a canvas-backing-store estimate.

interface MemoryMeasurement {
  bytes: number;
}
type MeasureMemory = () => Promise<MemoryMeasurement>;

/** Σ (width · height · 4) over every <canvas> currently in the DOM. Cheap and
 *  synchronous; an estimate of the GPU/canvas memory performance.memory misses
 *  (main canvas, working copy, thumbnails, magnifier). Excludes OffscreenCanvas
 *  and worker-owned canvases, which aren't in the document. */
function estimateCanvasBytes(): number {
  let total = 0;
  for (const c of Array.from(document.querySelectorAll("canvas"))) {
    total += c.width * c.height * 4;
  }
  return total;
}

// Subsystems shown as "processes", in a stable default order.
const ALL_SOURCES: LogSource[] = [
  "WASM_ENGINE",
  "UI_THREAD",
  "CONVEX_DB",
  "REPLICATE_AI",
  "CONSOLE",
];

/** Rolling window over which subsystem activity is aggregated. */
const WINDOW_MS = 10_000;

export interface ProcessRow {
  source: LogSource;
  /** Events logged by this subsystem within the window. */
  events: number;
  /** Summed durationMs of timed operations within the window ("CPU TIME"). */
  cpuMs: number;
  /** Share of total timed work in the window, 0..100 ("%CPU"). */
  cpuPct: number;
  /** Timestamp of the most recent event, or null if idle. */
  lastTs: number | null;
}

export interface ResourceSnapshot {
  /** Rolling frames-per-second of the main thread. */
  fps: number;
  /** Average frame interval in ms over the last sample. */
  frameMs: number;
  /** Main-thread load estimate 0..1, from how far the frame interval exceeds the 60fps budget. */
  cpuLoad: number;
  /** Used JS heap in bytes (Chrome only; null elsewhere). */
  jsHeapUsed: number | null;
  /** JS heap ceiling in bytes (Chrome only; null elsewhere). */
  jsHeapLimit: number | null;
  /** WASM linear memory size in bytes, or null until the engine loads. */
  wasmBytes: number | null;
  /** Whole-tab memory (all JS heaps + WASM + canvas + workers) from
   *  performance.measureUserAgentSpecificMemory(); null unless the page is
   *  cross-origin isolated (COOP+COEP) and the API is supported. This is the
   *  number that matches Chrome's per-tab "Memory footprint". */
  tabBytes: number | null;
  /** Estimated canvas backing-store bytes (Σ width·height·4 over DOM canvases).
   *  Off-heap GPU memory that performance.memory cannot see. */
  canvasBytes: number | null;
  /** Logical CPU cores reported by the browser. */
  cores: number;
  /** Approx device RAM in GB (Chrome only; null elsewhere). */
  deviceMemoryGB: number | null;
  /** Per-subsystem activity, sorted busiest-first. */
  processes: ProcessRow[];
  windowMs: number;
}

interface PerfMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function buildProcesses(now: number): ProcessRow[] {
  const since = now - WINDOW_MS;
  const agg = new Map<
    LogSource,
    { events: number; cpuMs: number; lastTs: number | null }
  >();
  for (const s of ALL_SOURCES) agg.set(s, { events: 0, cpuMs: 0, lastTs: null });

  for (const e of getDiagnostics()) {
    if (e.ts < since) continue;
    const a = agg.get(e.source);
    if (!a) continue;
    a.events += 1;
    a.cpuMs += e.durationMs ?? 0;
    a.lastTs = a.lastTs == null ? e.ts : Math.max(a.lastTs, e.ts);
  }

  let totalCpu = 0;
  for (const a of agg.values()) totalCpu += a.cpuMs;

  return ALL_SOURCES.map((source) => {
    const a = agg.get(source)!;
    return {
      source,
      events: a.events,
      cpuMs: a.cpuMs,
      cpuPct: totalCpu > 0 ? (a.cpuMs / totalCpu) * 100 : 0,
      lastTs: a.lastTs,
    };
  }).sort((x, y) => y.cpuMs - x.cpuMs || y.events - x.events);
}

/**
 * Sample live resource usage while `active`. The rAF FPS loop and the periodic
 * snapshot both shut down when `active` flips false (i.e. the Resources tab is
 * hidden or the overlay closed), so the monitor costs nothing at rest.
 */
export function useResourceMonitor(active: boolean): ResourceSnapshot | null {
  const [snap, setSnap] = useState<ResourceSnapshot | null>(null);
  const fpsRef = useRef({ fps: 0, frameMs: 0 });
  // Last whole-tab measurement. measureUserAgentSpecificMemory() is async and
  // browser-throttled, so we cache its result and read it synchronously in the
  // snapshot build.
  const tabBytesRef = useRef<number | null>(null);

  // FPS / frame-interval sampler.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let acc = 0;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      frames += 1;
      acc += dt;
      if (acc >= 500) {
        fpsRef.current = { fps: (frames * 1000) / acc, frameMs: acc / frames };
        frames = 0;
        acc = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  // Periodic snapshot build.
  useEffect(() => {
    if (!active) {
      setSnap(null);
      tabBytesRef.current = null;
      return;
    }
    const target = 1000 / 60;
    const perf = performance as Performance & {
      memory?: PerfMemory;
      measureUserAgentSpecificMemory?: MeasureMemory;
    };

    // Whole-tab memory is async + browser-throttled and only available when the
    // page is cross-origin isolated (COOP+COEP). Sample at most every 5s, cache
    // the last value, and never block the snapshot on the promise.
    let lastMeasure = 0;
    let measuring = false;
    const maybeMeasureTab = (nowMs: number) => {
      if (
        measuring ||
        !crossOriginIsolated ||
        typeof perf.measureUserAgentSpecificMemory !== "function" ||
        nowMs - lastMeasure < 5000
      )
        return;
      measuring = true;
      lastMeasure = nowMs;
      perf
        .measureUserAgentSpecificMemory()
        .then((m) => {
          tabBytesRef.current = m.bytes;
        })
        .catch(() => {
          // Throttled or unsupported — keep the previously cached value.
        })
        .finally(() => {
          measuring = false;
        });
    };

    const build = () => {
      const { fps, frameMs } = fpsRef.current;
      const perfMem = perf.memory;
      const nav = navigator as Navigator & { deviceMemory?: number };
      maybeMeasureTab(performance.now());
      setSnap({
        fps: Math.round(fps),
        frameMs,
        cpuLoad:
          frameMs > 0
            ? Math.min(1, Math.max(0, (frameMs - target) / (200 - target)))
            : 0,
        jsHeapUsed: perfMem?.usedJSHeapSize ?? null,
        jsHeapLimit: perfMem?.jsHeapSizeLimit ?? null,
        wasmBytes: wasmMemory ? wasmMemory.buffer.byteLength : null,
        tabBytes: tabBytesRef.current,
        canvasBytes: estimateCanvasBytes(),
        cores: nav.hardwareConcurrency ?? 0,
        deviceMemoryGB: nav.deviceMemory ?? null,
        processes: buildProcesses(Date.now()),
        windowMs: WINDOW_MS,
      });
    };
    build();
    const id = window.setInterval(build, 800);
    return () => window.clearInterval(id);
  }, [active]);

  return active ? snap : null;
}

/** Format a byte count as a compact human string (e.g. "18.4 MB"). */
export function fmtBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
