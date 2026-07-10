// app/src/components/ResourceMonitor.tsx
//
// The "Resources" tab of the Alt+Delete diagnostics overlay: a small htop-style
// view of what the app is spending the machine on — main-thread frame load,
// JS heap, the WASM engine's linear memory, and a per-subsystem process list.

import { useState } from "react";
import { Cpu, MemoryStick, Boxes, HardDrive, Layers } from "lucide-react";
import {
  fmtBytes,
  useResourceMonitor,
  type ProcessRow,
} from "@/lib/resourceMonitor";
import type { LogSource } from "@/lib/diagnosticsLog";
import {
  runThreadedBlurBench,
  type ThreadedBlurBenchResult,
} from "@/lib/threadedBlurBench";

/** Solid bar fill per subsystem, echoing the badge colors in the log table. */
const BAR_CLASS: Record<LogSource, string> = {
  WASM_ENGINE: "bg-warning",
  CONVEX_DB: "bg-blue-500",
  REPLICATE_AI: "bg-violet-500",
  UI_THREAD: "bg-success",
  CONSOLE: "bg-bg-elevated",
};

const TEXT_CLASS: Record<LogSource, string> = {
  WASM_ENGINE: "text-warning",
  CONVEX_DB: "text-blue-400",
  REPLICATE_AI: "text-violet-400",
  UI_THREAD: "text-success",
  CONSOLE: "text-text-secondary",
};

/** Pick a green→amber→red bar color from a 0..1 load. */
function loadBar(load: number): string {
  if (load > 0.66) return "bg-destructive";
  if (load > 0.33) return "bg-warning";
  return "bg-success";
}

function Gauge({
  icon,
  label,
  pct,
  value,
  barClass,
}: {
  icon: React.ReactNode;
  label: string;
  /** 0..1 fill fraction; null hides the bar (metric unavailable). */
  pct: number | null;
  value: string;
  barClass?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-20 shrink-0 items-center gap-1.5 text-text-secondary">
        {icon}
        <span className="whitespace-nowrap text-2xs uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-card/80">
        {pct != null && (
          <div
            className={`h-full rounded-full ${barClass ?? loadBar(pct)} transition-[width] duration-300`}
            style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }}
          />
        )}
      </div>
      <div className="w-32 shrink-0 whitespace-nowrap text-right tabular-nums text-text-secondary">
        {value}
      </div>
    </div>
  );
}

function ProcRow({ p, now }: { p: ProcessRow; now: number }) {
  const idle = p.lastTs == null;
  const ago = idle ? "—" : `${Math.round((now - (p.lastTs ?? now)) / 1000)}s`;
  return (
    <tr className="border-t border-border hover:bg-card/30">
      <td className="px-3 py-1">
        <span className={`font-bold ${TEXT_CLASS[p.source]}`}>{p.source}</span>
      </td>
      <td className="px-3 py-1 text-right tabular-nums text-text-secondary">
        {p.events}
      </td>
      <td className="px-3 py-1 text-right tabular-nums text-text-secondary">
        {p.cpuMs > 0 ? `${p.cpuMs.toFixed(1)}ms` : "—"}
      </td>
      <td className="px-3 py-1 text-right tabular-nums text-text-muted">{ago}</td>
      <td className="px-3 py-1">
        <div className="flex items-center gap-2">
          <div className="relative h-2.5 w-24 overflow-hidden rounded-sm bg-background">
            <div
              className={`h-full ${BAR_CLASS[p.source]} transition-[width] duration-300`}
              style={{ width: `${Math.min(100, p.cpuPct)}%` }}
            />
          </div>
          <span className="w-10 text-right tabular-nums text-text-secondary">
            {p.cpuPct.toFixed(0)}%
          </span>
        </div>
      </td>
    </tr>
  );
}

/**
 * Threaded-blur microbench row (feat/rayon-parallel-blur, Task D). Inert on
 * the currently-shipped build — `runThreadedBlurBench` always resolves
 * `available: false` with an honest reason today, since neither COOP/COEP
 * headers nor a `--features threads` wasm build are shipped by this repo.
 * Exists so flipping both of those on later (a separate, later decision) has
 * somewhere to show the real in-browser number without any UI changes.
 */
function ThreadedBlurBenchRow() {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "running" }
    | { status: "done"; result: ThreadedBlurBenchResult }
  >({ status: "idle" });

  const run = async () => {
    setState({ status: "running" });
    const result = await runThreadedBlurBench();
    setState({ status: "done", result });
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-2xs text-text-muted">
      <div className="flex items-center justify-between">
        <span className="uppercase tracking-wider">
          Threaded Blur (experimental)
        </span>
        <button
          type="button"
          onClick={run}
          disabled={state.status === "running"}
          className="rounded border border-border px-2 py-0.5 text-text-secondary hover:bg-card/50 disabled:opacity-50"
        >
          {state.status === "running" ? "Running…" : "Run bench"}
        </button>
      </div>
      {state.status === "done" && (
        <div className="tabular-nums">
          {state.result.available
            ? `${state.result.width}×${state.result.height} r${state.result.radius}: ${state.result.ms.toFixed(1)}ms (${state.result.threads} threads)`
            : state.result.reason}
        </div>
      )}
    </div>
  );
}

export function ResourceMonitor({ active }: { active: boolean }) {
  const snap = useResourceMonitor(active);
  const now = Date.now();

  if (!snap) {
    return (
      <div className="px-4 py-10 text-center font-mono text-xs text-text-muted">
        Sampling…
      </div>
    );
  }

  const heapPct =
    snap.jsHeapUsed != null && snap.jsHeapLimit
      ? snap.jsHeapUsed / snap.jsHeapLimit
      : null;
  // The footprint gauges (Tab / WASM / Canvas) have no per-tab ceiling, so scale
  // them against device RAM (fallback 4 GB) — a meaningful, stable denominator,
  // unlike the old "fraction of the JS-heap limit / flat 0.1" which made a large
  // WASM heap render as a tiny bar.
  const memBudget = (snap.deviceMemoryGB ?? 4) * 1024 ** 3;
  const wasmPct = snap.wasmBytes != null ? snap.wasmBytes / memBudget : null;
  const canvasPct =
    snap.canvasBytes != null ? snap.canvasBytes / memBudget : null;
  const tabPct = snap.tabBytes != null ? snap.tabBytes / memBudget : null;

  return (
    <div className="flex flex-col gap-3 p-4 font-mono text-xs">
      {/* ── Top gauges: main thread + memory ─────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <Gauge
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="CPU"
          pct={snap.cpuLoad}
          value={`${snap.fps} fps · ${snap.frameMs.toFixed(1)}ms`}
        />
        {/* Whole-tab footprint — the number that matches Chrome's task manager.
            Listed first because it's the only one that captures canvas/worker
            memory; the gauges below break out the parts we can read directly. */}
        <Gauge
          icon={<HardDrive className="h-3.5 w-3.5" />}
          label="Tab"
          pct={tabPct}
          barClass={tabPct != null ? loadBar(tabPct) : undefined}
          value={snap.tabBytes != null ? fmtBytes(snap.tabBytes) : "n/a"}
        />
        <Gauge
          icon={<MemoryStick className="h-3.5 w-3.5" />}
          label="JS Heap"
          pct={heapPct}
          barClass={heapPct != null ? loadBar(heapPct) : undefined}
          value={
            snap.jsHeapUsed != null
              ? `${fmtBytes(snap.jsHeapUsed)} / ${fmtBytes(snap.jsHeapLimit)}`
              : "n/a"
          }
        />
        <Gauge
          icon={<Boxes className="h-3.5 w-3.5" />}
          label="WASM"
          pct={wasmPct}
          barClass="bg-warning"
          value={snap.wasmBytes != null ? fmtBytes(snap.wasmBytes) : "not loaded"}
        />
        <Gauge
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Canvas"
          pct={canvasPct}
          barClass="bg-violet-500"
          value={snap.canvasBytes != null ? fmtBytes(snap.canvasBytes) : "—"}
        />
      </div>

      <div className="text-2xs text-text-muted">
        {snap.cores} logical cores
        {snap.deviceMemoryGB != null ? ` · ~${snap.deviceMemoryGB} GB device RAM` : ""}
        {" · "}
        {(snap.windowMs / 1000).toFixed(0)}s activity window
      </div>
      <div className="text-2xs leading-relaxed text-text-muted">
        Tab = whole-page footprint (JS + WASM + canvas + workers), shown only when
        the page is cross-origin isolated. JS Heap &amp; WASM alone miss
        canvas/image memory; WASM only grows — reload to reclaim it.
      </div>

      {/* ── Per-subsystem "process" list ─────────────────────────────────── */}
      <table className="w-full border-collapse">
        <thead className="text-text-muted">
          <tr>
            <th className="px-3 py-1.5 text-left font-semibold">Subsystem</th>
            <th className="px-3 py-1.5 text-right font-semibold">Events</th>
            <th className="px-3 py-1.5 text-right font-semibold">CPU Time</th>
            <th className="px-3 py-1.5 text-right font-semibold">Last</th>
            <th className="px-3 py-1.5 text-left font-semibold">%CPU</th>
          </tr>
        </thead>
        <tbody>
          {snap.processes.map((p) => (
            <ProcRow key={p.source} p={p} now={now} />
          ))}
        </tbody>
      </table>

      <div className="text-center text-2xs text-text-muted">
        %CPU = share of timed work across subsystems in the last{" "}
        {(snap.windowMs / 1000).toFixed(0)}s
      </div>

      <ThreadedBlurBenchRow />
    </div>
  );
}
