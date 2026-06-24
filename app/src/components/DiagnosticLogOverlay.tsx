import { Trash2, Activity, Gauge, Image as ImageIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Modal } from "@/components/ui/Modal";
import { ResourceMonitor } from "@/components/ResourceMonitor";
import { ImageMetaPanel, type ImageMeta } from "@/components/ImageMetaPanel";
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
  imageMeta?: ImageMeta;
}

type Tab = "telemetry" | "resources" | "imagemeta";

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

export function DiagnosticLogOverlay({ open, onClose, imageMeta }: Props) {
  const entries = useSyncExternalStore(subscribeDiagnostics, getDiagnostics);
  const [tab, setTab] = useState<Tab>("telemetry");

  const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: "telemetry", label: "System Telemetry", icon: Activity },
    { id: "resources", label: "Resources", icon: Gauge },
    { id: "imagemeta", label: "Current Image Meta", icon: ImageIcon },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Diagnostics Window"
      icon={Activity}
      fill
      toolbar={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-bg-tertiary p-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  tab === id
                    ? "bg-bg-elevated text-text-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {id === "telemetry" && (
                  <span className={tab === id ? "text-text-secondary" : "text-text-muted"}>
                    ({entries.length})
                  </span>
                )}
              </button>
            ))}
          </div>
          {tab === "telemetry" && (
            <button
              onClick={clearDiagnostics}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-elevated hover:text-text-primary"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      }
      footer="Alt + Delete to toggle · in-memory only, never sent anywhere"
    >
      {tab === "resources" ? (
                <ResourceMonitor active={open && tab === "resources"} />
              ) : tab === "imagemeta" ? (
                <ImageMetaPanel
                  active={open && tab === "imagemeta"}
                  meta={imageMeta ?? { photoId: null }}
                />
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
    </Modal>
  );
}
