import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Activity, Gauge } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { fadeIn, quickSpring } from "@/lib/animations";
import { ResourceMonitor } from "@/components/ResourceMonitor";
import {
  clearDiagnostics,
  getDiagnostics,
  subscribeDiagnostics,
  type LogEntry,
  type LogSource,
} from "@/lib/diagnosticsLog";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "telemetry" | "resources";

const SOURCE_CLASS: Record<LogSource, string> = {
  WASM_ENGINE: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CONVEX_DB: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  REPLICATE_AI: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  UI_THREAD: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CONSOLE: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
};

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(
    d.getMilliseconds(),
    3,
  )}`;
}

export function DiagnosticLogOverlay({ open, onClose }: Props) {
  const entries = useSyncExternalStore(subscribeDiagnostics, getDiagnostics);
  const [tab, setTab] = useState<Tab>("telemetry");

  const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: "telemetry", label: "System Telemetry", icon: Activity },
    { id: "resources", label: "Resources", icon: Gauge },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-60 flex items-end justify-center bg-black/40"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={quickSpring}
            onClick={(e) => e.stopPropagation()}
            className="mb-6 flex max-h-[70vh] w-[min(960px,94vw)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 text-zinc-100 shadow-2xl"
          >
            <div className="border-b border-zinc-800">
              {/* Title + close */}
              <div className="flex items-center justify-between px-4 pt-2.5 pb-2">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-300">
                  <Activity className="h-4 w-4" />
                  Diagnostics Window
                </div>
                <button
                  onClick={onClose}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Tab switcher + contextual clear */}
              <div className="flex items-center justify-between px-4 pb-2">
                <div className="flex items-center gap-1 rounded-lg bg-zinc-900 p-1">
                  {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                        tab === id
                          ? "bg-zinc-700 text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {id === "telemetry" && (
                        <span className="text-zinc-600">({entries.length})</span>
                      )}
                    </button>
                  ))}
                </div>
                {tab === "telemetry" && (
                  <button
                    onClick={clearDiagnostics}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === "resources" ? (
                <ResourceMonitor active={open && tab === "resources"} />
              ) : entries.length === 0 ? (
                <div className="px-4 py-10 text-center font-mono text-xs text-zinc-600">
                  No events yet. Warnings, errors, and timed operations appear here.
                </div>
              ) : (
                <table className="w-full border-collapse font-mono text-xs">
                  <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Time</th>
                      <th className="px-3 py-1.5 text-left font-medium">Source</th>
                      <th className="px-3 py-1.5 text-left font-medium">Message</th>
                      <th className="px-3 py-1.5 text-right font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...entries].reverse().map((log: LogEntry) => (
                      <tr
                        key={log.id}
                        className="border-t border-zinc-800/60 hover:bg-zinc-800/30"
                      >
                        <td className="whitespace-nowrap px-3 py-1 text-zinc-500">
                          {fmtTime(log.ts)}
                        </td>
                        <td className="px-3 py-1">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${SOURCE_CLASS[log.source]}`}
                          >
                            {log.source}
                          </span>
                        </td>
                        <td className="px-3 py-1 text-zinc-300">{log.message}</td>
                        <td className="whitespace-nowrap px-3 py-1 text-right font-semibold text-emerald-400">
                          {log.durationMs != null
                            ? `${log.durationMs.toFixed(1)}ms`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t border-zinc-800 px-4 py-1.5 text-center font-mono text-[10px] text-zinc-600">
              Alt + Delete to toggle · in-memory only, never sent anywhere
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
