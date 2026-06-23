// app/src/components/ResourceMonitor.tsx
//
// The "Resources" tab of the Alt+Delete diagnostics overlay: a small htop-style
// view of what the app is spending the machine on — main-thread frame load,
// JS heap, the WASM engine's linear memory, and a per-subsystem process list.

import { Cpu, MemoryStick, Boxes } from "lucide-react";
import {
  fmtBytes,
  useResourceMonitor,
  type ProcessRow,
} from "@/lib/resourceMonitor";
import type { LogSource } from "@/lib/diagnosticsLog";

/** Solid bar fill per subsystem, echoing the badge colors in the log table. */
const BAR_CLASS: Record<LogSource, string> = {
  WASM_ENGINE: "bg-amber-500",
  CONVEX_DB: "bg-blue-500",
  REPLICATE_AI: "bg-violet-500",
  UI_THREAD: "bg-emerald-500",
  CONSOLE: "bg-zinc-500",
};

const TEXT_CLASS: Record<LogSource, string> = {
  WASM_ENGINE: "text-amber-400",
  CONVEX_DB: "text-blue-400",
  REPLICATE_AI: "text-violet-400",
  UI_THREAD: "text-emerald-400",
  CONSOLE: "text-zinc-400",
};

/** Pick a green→amber→red bar color from a 0..1 load. */
function loadBar(load: number): string {
  if (load > 0.66) return "bg-red-500";
  if (load > 0.33) return "bg-amber-500";
  return "bg-emerald-500";
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
    <div className="flex items-center gap-2">
      <div className="flex w-16 shrink-0 items-center gap-1.5 text-zinc-400">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="relative h-3.5 flex-1 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900">
        {pct != null && (
          <div
            className={`h-full ${barClass ?? loadBar(pct)} transition-[width] duration-300`}
            style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }}
          />
        )}
      </div>
      <div className="w-32 shrink-0 text-right tabular-nums text-zinc-300">
        {value}
      </div>
    </div>
  );
}

function ProcRow({ p, now }: { p: ProcessRow; now: number }) {
  const idle = p.lastTs == null;
  const ago = idle ? "—" : `${Math.round((now - (p.lastTs ?? now)) / 1000)}s`;
  return (
    <tr className="border-t border-zinc-800/60 hover:bg-zinc-800/30">
      <td className="px-3 py-1">
        <span className={`font-bold ${TEXT_CLASS[p.source]}`}>{p.source}</span>
      </td>
      <td className="px-3 py-1 text-right tabular-nums text-zinc-400">
        {p.events}
      </td>
      <td className="px-3 py-1 text-right tabular-nums text-zinc-400">
        {p.cpuMs > 0 ? `${p.cpuMs.toFixed(1)}ms` : "—"}
      </td>
      <td className="px-3 py-1 text-right tabular-nums text-zinc-500">{ago}</td>
      <td className="px-3 py-1">
        <div className="flex items-center gap-2">
          <div className="relative h-2.5 w-24 overflow-hidden rounded-sm bg-zinc-900">
            <div
              className={`h-full ${BAR_CLASS[p.source]} transition-[width] duration-300`}
              style={{ width: `${Math.min(100, p.cpuPct)}%` }}
            />
          </div>
          <span className="w-10 text-right tabular-nums text-zinc-400">
            {p.cpuPct.toFixed(0)}%
          </span>
        </div>
      </td>
    </tr>
  );
}

export function ResourceMonitor({ active }: { active: boolean }) {
  const snap = useResourceMonitor(active);
  const now = Date.now();

  if (!snap) {
    return (
      <div className="px-4 py-10 text-center font-mono text-xs text-zinc-600">
        Sampling…
      </div>
    );
  }

  const heapPct =
    snap.jsHeapUsed != null && snap.jsHeapLimit
      ? snap.jsHeapUsed / snap.jsHeapLimit
      : null;
  // WASM has no fixed ceiling here; show its size relative to the JS heap
  // limit just to give the bar a sensible scale.
  const wasmPct =
    snap.wasmBytes != null && snap.jsHeapLimit
      ? snap.wasmBytes / snap.jsHeapLimit
      : snap.wasmBytes != null
        ? 0.1
        : null;

  return (
    <div className="flex flex-col gap-3 p-4 font-mono text-xs">
      {/* ── Top gauges: main thread + memory ─────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Gauge
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="CPU"
          pct={snap.cpuLoad}
          value={`${snap.fps} fps · ${snap.frameMs.toFixed(1)}ms`}
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
          barClass="bg-amber-500"
          value={snap.wasmBytes != null ? fmtBytes(snap.wasmBytes) : "not loaded"}
        />
      </div>

      <div className="text-[10px] text-zinc-600">
        {snap.cores} logical cores
        {snap.deviceMemoryGB != null ? ` · ~${snap.deviceMemoryGB} GB device RAM` : ""}
        {" · "}
        {(snap.windowMs / 1000).toFixed(0)}s activity window
      </div>

      {/* ── Per-subsystem "process" list ─────────────────────────────────── */}
      <table className="w-full border-collapse">
        <thead className="text-zinc-500">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium">Subsystem</th>
            <th className="px-3 py-1.5 text-right font-medium">Events</th>
            <th className="px-3 py-1.5 text-right font-medium">CPU Time</th>
            <th className="px-3 py-1.5 text-right font-medium">Last</th>
            <th className="px-3 py-1.5 text-left font-medium">%CPU</th>
          </tr>
        </thead>
        <tbody>
          {snap.processes.map((p) => (
            <ProcRow key={p.source} p={p} now={now} />
          ))}
        </tbody>
      </table>

      <div className="text-center text-[10px] text-zinc-600">
        %CPU = share of timed work across subsystems in the last{" "}
        {(snap.windowMs / 1000).toFixed(0)}s
      </div>
    </div>
  );
}
