// app/src/hooks/useDiagnostics.ts
//
// Single owner of every Diagnostics-window timer, split into three polling
// tiers so the panel can never become the perf problem it measures:
//   Tier 0 — on-open / on-demand only. Expensive async reads, driven by the
//            panel opening and by refresh(). Never on an interval.
//   Tier 1 — 1.5s interval, only while the panel is visible.
//   Tier 2 — per animation frame, only while the panel is visible AND the
//            user is actively interacting with a canvas (pointer activity
//            within the last ~500ms). Freezes at its last value on idle;
//            stops entirely on panel close.
// All three tiers tear down completely on panel close/unmount — verify with
// the profiler: closed panel = zero diagnostic callbacks firing.

import { useCallback, useEffect, useRef, useState } from "react";
import { getDiagnostics, type LogSource } from "@/lib/diagnosticsLog";
import {
  getOplogPersistStats,
  getOplogStats,
  getTilesDirtyCount,
  getWasmMemoryBytes,
  type OplogPersistStats,
  type OplogStats,
} from "@/lib/resourceMonitor";

const TIER1_INTERVAL_MS = 1500;
const INTERACTION_POLL_MS = 150;
const INTERACTION_IDLE_MS = 500;

/** Σ (width · height · 4) over every <canvas> currently in the DOM — a cheap,
 *  synchronous estimate of canvas/GPU backing-store memory performance.memory
 *  can't see (main canvas, working copy, thumbnails, magnifier). */
function estimateCanvasBytes(): number {
  let total = 0;
  for (const c of Array.from(document.querySelectorAll("canvas"))) {
    total += c.width * c.height * 4;
  }
  return total;
}

interface PerfMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}
type MeasureMemory = () => Promise<{ bytes: number }>;

// Subsystems shown as "processes" in the Resources tab, in a stable order.
const ALL_SOURCES: LogSource[] = [
  "WASM_ENGINE",
  "UI_THREAD",
  "CONVEX_DB",
  "REPLICATE_AI",
  "CONSOLE",
];

/** Rolling window over which subsystem activity is aggregated. */
const PROCESS_WINDOW_MS = 10_000;

export interface ProcessRow {
  source: LogSource;
  events: number;
  cpuMs: number;
  cpuPct: number;
  lastTs: number | null;
}

function buildProcesses(now: number): ProcessRow[] {
  const since = now - PROCESS_WINDOW_MS;
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

// ── Tier 0 — on-open / on-demand ─────────────────────────────────────────
interface DiagTier0 {
  /** Whole-tab memory footprint (JS + WASM + canvas + workers), from
   *  measureUserAgentSpecificMemory(); null unless cross-origin isolated and
   *  the API is supported. Expensive + browser-throttled — read on open and
   *  on refresh() only, never on an interval. */
  tabBytes: number | null;
  cores: number;
  deviceMemoryGB: number | null;
}

// ── Tier 1 — 1.5s while visible ──────────────────────────────────────────
interface DiagTier1 {
  jsHeapUsed: number | null;
  jsHeapLimit: number | null;
  wasmBytes: number | null;
  canvasBytes: number | null;
}

// ── Tier 2 — per-frame while visible + interacting ───────────────────────
interface DiagTier2 {
  fps: number;
  frameMs: number;
  cpuLoad: number;
}

export interface DiagnosticsSnapshot {
  tier0: DiagTier0;
  /** null until the first Tier-1 tick has run. */
  tier1: DiagTier1 | null;
  /** null until the user's first canvas interaction; holds its last value
   *  (frozen) once interaction stops rather than clearing. */
  tier2: DiagTier2 | null;
  interacting: boolean;
  processes: ProcessRow[];
  windowMs: number;
  /** Tiles marked dirty by the most recent tile-engine flush, read on the
   *  Tier-1 cadence; `null` when the tile path isn't active this flush
   *  (see `registerTilesDirtyCount` in lib/resourceMonitor.ts). Verification
   *  instrument for the tile-wiring session — not shipped/user-facing. */
  tilesDirtyCount: number | null;
  /** Op-log recorder state as of the last flush, or `null` when the build
   *  lacks the op-log exports (see `registerOplogStats`). Same
   *  verification-only status as `tilesDirtyCount`. */
  oplog: OplogStats | null;
  /** What the op log has actually PERSISTED for the active photo (and whether
   *  that photo was restored from it), or `null` when op-log persistence is
   *  off — the flag's default. See `registerOplogPersistStats`. */
  oplogPersist: OplogPersistStats | null;
  /** Re-reads every Tier-0 field immediately. */
  refresh: () => void;
}

/**
 * Owns all Diagnostics-window polling. `active` should be `open && <this
 * tab is the visible one>` — pass false and every timer this hook owns tears
 * down within one effect-cleanup pass.
 */
export function useDiagnostics(active: boolean): DiagnosticsSnapshot {
  const [tier0, setTier0] = useState<DiagTier0>({
    tabBytes: null,
    cores: 0,
    deviceMemoryGB: null,
  });
  const [tier1, setTier1] = useState<DiagTier1 | null>(null);
  const [tier2, setTier2] = useState<DiagTier2 | null>(null);
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [tilesDirtyCount, setTilesDirtyCount] = useState<number | null>(null);
  const [oplog, setOplog] = useState<OplogStats | null>(null);
  const [oplogPersist, setOplogPersist] = useState<OplogPersistStats | null>(null);
  const [interacting, setInteracting] = useState(false);
  const lastInteractionRef = useRef(0);

  // ── Tier 0 ────────────────────────────────────────────────────────────
  const readTier0 = useCallback(() => {
    const perf = performance as Performance & {
      measureUserAgentSpecificMemory?: MeasureMemory;
    };
    const nav = navigator as Navigator & { deviceMemory?: number };
    setTier0((prev) => ({
      ...prev,
      cores: nav.hardwareConcurrency ?? 0,
      deviceMemoryGB: nav.deviceMemory ?? null,
    }));
    if (
      crossOriginIsolated &&
      typeof perf.measureUserAgentSpecificMemory === "function"
    ) {
      perf
        .measureUserAgentSpecificMemory()
        .then((m) => setTier0((prev) => ({ ...prev, tabBytes: m.bytes })))
        .catch(() => {
          // Throttled or unsupported — keep the previously read value.
        });
    }
  }, []);

  const refresh = useCallback(() => {
    if (active) readTier0();
  }, [active, readTier0]);

  useEffect(() => {
    if (!active) {
      setTier0({ tabBytes: null, cores: 0, deviceMemoryGB: null });
      return;
    }
    readTier0();
  }, [active, readTier0]);

  // ── Tier 1 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) {
      setTier1(null);
      setProcesses([]);
      setTilesDirtyCount(null);
      setOplog(null);
      setOplogPersist(null);
      return;
    }
    const perf = performance as Performance & { memory?: PerfMemory };
    const build = () => {
      const perfMem = perf.memory;
      setTier1({
        jsHeapUsed: perfMem?.usedJSHeapSize ?? null,
        jsHeapLimit: perfMem?.jsHeapSizeLimit ?? null,
        wasmBytes: getWasmMemoryBytes(),
        canvasBytes: estimateCanvasBytes(),
      });
      setProcesses(buildProcesses(Date.now()));
      setTilesDirtyCount(getTilesDirtyCount());
      setOplog(getOplogStats());
      setOplogPersist(getOplogPersistStats());
    };
    build();
    const id = window.setInterval(build, TIER1_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active]);

  // ── Interaction tracking: pointer activity on a <canvas>, ~500ms window ─
  useEffect(() => {
    if (!active) {
      setInteracting(false);
      return;
    }
    const onPointer = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest("canvas")) {
        lastInteractionRef.current = performance.now();
      }
    };
    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    const id = window.setInterval(() => {
      setInteracting(
        performance.now() - lastInteractionRef.current < INTERACTION_IDLE_MS,
      );
    }, INTERACTION_POLL_MS);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("pointermove", onPointer);
      window.clearInterval(id);
      setInteracting(false);
    };
  }, [active]);

  // ── Tier 2: rAF FPS loop, only while visible + interacting. Stopping
  // interaction just lets this effect's cleanup cancel the loop — tier2
  // keeps its last value (frozen) rather than clearing, per spec. ────────
  useEffect(() => {
    if (!active) {
      setTier2(null);
      return;
    }
    if (!interacting) return;
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let acc = 0;
    const target = 1000 / 60;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      frames += 1;
      acc += dt;
      if (acc >= 500) {
        const fps = (frames * 1000) / acc;
        const frameMs = acc / frames;
        setTier2({
          fps: Math.round(fps),
          frameMs,
          cpuLoad: Math.min(1, Math.max(0, (frameMs - target) / (200 - target))),
        });
        frames = 0;
        acc = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, interacting]);

  return {
    tier0,
    tier1,
    tier2,
    interacting,
    processes,
    windowMs: PROCESS_WINDOW_MS,
    tilesDirtyCount,
    oplog,
    oplogPersist,
    refresh,
  };
}
