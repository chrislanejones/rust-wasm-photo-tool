// app/src/components/ResourceMonitor.tsx
//
// The "Resources" tab of the Alt+Delete diagnostics overlay: a small htop-style
// view of what the app is spending the machine on — main-thread frame load,
// JS heap, the WASM engine's linear memory, and a per-subsystem process list.

import { useState } from "react";
import {
  Cpu,
  MemoryStick,
  Boxes,
  HardDrive,
  Layers,
  RefreshCw,
  Grid2x2,
  Database,
} from "lucide-react";
import { fmtBytes } from "@/lib/resourceMonitor";
import type { DiagnosticsSnapshot, ProcessRow } from "@/hooks/useDiagnostics";
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
      <div className="w-36 shrink-0 truncate text-right tabular-nums text-text-secondary">
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

export function ResourceMonitor({
  diag,
  onRefresh,
}: {
  diag: DiagnosticsSnapshot;
  onRefresh: () => void;
}) {
  const { tier0, tier1, tier2, processes, windowMs, tilesDirtyCount, oplog, oplogPersist } =
    diag;
  const now = Date.now();

  if (!tier1) {
    return (
      <div className="px-4 py-10 text-center font-mono text-xs text-text-muted">
        Sampling…
      </div>
    );
  }

  const heapPct =
    tier1.jsHeapUsed != null && tier1.jsHeapLimit
      ? tier1.jsHeapUsed / tier1.jsHeapLimit
      : null;
  // The footprint gauges (Tab / WASM / Canvas) have no per-tab ceiling, so scale
  // them against device RAM (fallback 4 GB) — a meaningful, stable denominator,
  // unlike the old "fraction of the JS-heap limit / flat 0.1" which made a large
  // WASM heap render as a tiny bar.
  const memBudget = (tier0.deviceMemoryGB ?? 4) * 1024 ** 3;
  const wasmPct = tier1.wasmBytes != null ? tier1.wasmBytes / memBudget : null;
  const canvasPct =
    tier1.canvasBytes != null ? tier1.canvasBytes / memBudget : null;
  const tabPct = tier0.tabBytes != null ? tier0.tabBytes / memBudget : null;

  return (
    <div className="flex flex-col gap-3 p-4 font-mono text-xs">
      {/* Manual refresh — the only trigger for Tier-0 reads (tab memory,
          cores/RAM); they never poll on an interval. */}
      <div className="flex items-center justify-end">
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-text-muted hover:bg-bg-elevated hover:text-text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Top gauges: main thread + memory ─────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <Gauge
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="CPU"
          pct={tier2?.cpuLoad ?? null}
          value={
            tier2
              ? `${tier2.fps} fps · ${tier2.frameMs.toFixed(1)}ms`
              : "idle — interact"
          }
        />
        {/* Whole-tab footprint — the number that matches Chrome's task manager.
            Listed first because it's the only one that captures canvas/worker
            memory; the gauges below break out the parts we can read directly. */}
        <Gauge
          icon={<HardDrive className="h-3.5 w-3.5" />}
          label="Tab"
          pct={tabPct}
          barClass={tabPct != null ? loadBar(tabPct) : undefined}
          value={tier0.tabBytes != null ? fmtBytes(tier0.tabBytes) : "n/a"}
        />
        <Gauge
          icon={<MemoryStick className="h-3.5 w-3.5" />}
          label="JS Heap"
          pct={heapPct}
          barClass={heapPct != null ? loadBar(heapPct) : undefined}
          value={
            tier1.jsHeapUsed != null
              ? `${fmtBytes(tier1.jsHeapUsed)} / ${fmtBytes(tier1.jsHeapLimit)}`
              : "n/a"
          }
        />
        <Gauge
          icon={<Boxes className="h-3.5 w-3.5" />}
          label="WASM"
          pct={wasmPct}
          barClass="bg-warning"
          value={tier1.wasmBytes != null ? fmtBytes(tier1.wasmBytes) : "not loaded"}
        />
        <Gauge
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Canvas"
          pct={canvasPct}
          barClass="bg-violet-500"
          value={tier1.canvasBytes != null ? fmtBytes(tier1.canvasBytes) : "—"}
        />
        {tilesDirtyCount != null && (
          <Gauge
            icon={<Grid2x2 className="h-3.5 w-3.5" />}
            label="Dirty"
            pct={null}
            value={`${tilesDirtyCount} tile${tilesDirtyCount === 1 ? "" : "s"}`}
          />
        )}
        {oplog != null && (
          <Gauge
            icon={<Grid2x2 className="h-3.5 w-3.5" />}
            label="Op Log"
            pct={null}
            value={
              oplog.broken
                ? "broken → snapshots"
                : oplog.active
                  ? `${oplog.cursor}/${oplog.ops} ops · ${oplog.keyframes} kf${oplog.undoEnabled ? " · undo" : ""}`
                  : "n/a"
            }
          />
        )}
        {oplogPersist != null && (
          <Gauge
            icon={<Database className="h-3.5 w-3.5" />}
            label="Persisted"
            pct={null}
            value={
              oplogPersist.stale
                ? "retired → working copy"
                : `${oplogPersist.ops} ops · ${oplogPersist.keyframes} kf · ${oplogPersist.chunks} chunk${oplogPersist.chunks === 1 ? "" : "s"}${
                    oplogPersist.source === "restored" ? " · restored" : ""
                  }`
            }
          />
        )}
      </div>

      <div className="text-2xs text-text-muted">
        {tier0.cores} logical cores
        {tier0.deviceMemoryGB != null ? ` · ~${tier0.deviceMemoryGB} GB device RAM` : ""}
        {" · "}
        {(windowMs / 1000).toFixed(0)}s activity window
      </div>
      <div className="text-2xs leading-relaxed text-text-muted">
        Tab = whole-page footprint (JS + WASM + canvas + workers), shown only when
        the page is cross-origin isolated. JS Heap &amp; WASM alone miss
        canvas/image memory; WASM only grows — reload to reclaim it. CPU only
        samples while you're actively interacting with the canvas.
        {tilesDirtyCount != null &&
          " Dirty = tiles touched by the tile-engine flush since it was last read (verification-only, tile-wiring session — not shipped)."}
        {oplog != null &&
          " Op Log = recorded edits / cursor · resident keyframes; \"undo\" = replay-undo switch on (ih_oplog_undo). Broken = an unrecorded edit desynced it; snapshot undo took over."}
        {oplogPersist != null &&
          " Persisted = what's actually in IndexedDB for this photo (ih_oplog_persist); \"restored\" = this photo came back from its op log, not the working copy. Retired = the log stopped matching the document (unrecorded edit or multi-layer), so resume falls back to the working copy."}
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
          {processes.map((p) => (
            <ProcRow key={p.source} p={p} now={now} />
          ))}
        </tbody>
      </table>

      <div className="text-center text-2xs text-text-muted">
        %CPU = share of timed work across subsystems in the last{" "}
        {(windowMs / 1000).toFixed(0)}s
      </div>

      <ThreadedBlurBenchRow />
    </div>
  );
}
