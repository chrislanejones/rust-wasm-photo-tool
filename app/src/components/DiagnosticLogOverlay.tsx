import { Trash2, Activity, Gauge, Image as ImageIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  WASM_ENGINE: "bg-warning/10 text-warning border-warning/20",
  CONVEX_DB: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  REPLICATE_AI: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  UI_THREAD: "bg-success/10 text-success border-success/20",
  CONSOLE: "bg-bg-elevated/40 text-text-secondary border-border/40",
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="xl"
        aria-describedby={undefined}
        className="flex h-[80vh] flex-col"
      >
        {/* Header block: title row + the tab toolbar share one bottom border. */}
        <div className="border-b border-border">
          <DialogHeader className="border-b-0 px-4 py-2.5">
            <DialogTitle className="flex items-center gap-2 font-mono text-xs font-normal uppercase tracking-wider text-text-secondary">
              <Activity className="h-4 w-4" />
              Diagnostics Window
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-lg bg-bg-tertiary p-1">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-2xs uppercase tracking-wider transition-colors ${
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
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "resources" ? (
            <ResourceMonitor active={open && tab === "resources"} />
          ) : tab === "imagemeta" ? (
            <ImageMetaPanel
              active={open && tab === "imagemeta"}
              meta={imageMeta ?? { photoId: null }}
            />
          ) : entries.length === 0 ? (
            <div className="px-4 py-10 text-center font-mono text-xs text-text-muted">
              No events yet. Warnings, errors, and timed operations appear here.
            </div>
          ) : (
            <table className="w-full border-collapse font-mono text-xs">
              <thead className="sticky top-0 bg-background text-text-muted">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold">Time</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Source</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Message</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody>
                {[...entries].reverse().map((log: LogEntry) => (
                  <tr
                    key={log.id}
                    className="border-t border-border hover:bg-card/30"
                  >
                    <td className="whitespace-nowrap px-3 py-1 text-text-muted">
                      {fmtTime(log.ts)}
                    </td>
                    <td className="px-3 py-1">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-2xs font-bold ${SOURCE_CLASS[log.source]}`}
                      >
                        {log.source}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-text-secondary">{log.message}</td>
                    <td className="whitespace-nowrap px-3 py-1 text-right font-semibold text-success">
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

        <DialogFooter className="block border-t border-border px-4 py-2.5">
          <p className="text-center font-mono text-2xs text-text-muted">
            Alt + Delete to toggle · in-memory only, never sent anywhere
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
