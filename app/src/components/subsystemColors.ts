// One color per diagnostics subsystem, in the three forms the Diagnostics
// window draws it: the Telemetry table's badge, the Resources bar fill, and the
// bare subsystem name. These were three separate maps in two files, so adding
// a subsystem (INDEXEDDB was the last) meant remembering three edits.
import type { LogSource } from "@/lib/diagnosticsLog";

export const SUBSYSTEM_COLOR: Record<LogSource, { badge: string; bar: string; text: string }> = {
  WASM_ENGINE: {
    badge: "bg-warning/10 text-warning border-warning/20",
    bar: "bg-warning",
    text: "text-warning",
  },
  CONVEX_DB: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    bar: "bg-blue-500",
    text: "text-blue-400",
  },
  // Local IndexedDB — teal to sit next to the cloud blue without being it.
  INDEXEDDB: {
    badge: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    bar: "bg-teal-500",
    text: "text-teal-400",
  },
  REPLICATE_AI: {
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    bar: "bg-violet-500",
    text: "text-violet-400",
  },
  UI_THREAD: {
    badge: "bg-success/10 text-success border-success/20",
    bar: "bg-success",
    text: "text-success",
  },
  CONSOLE: {
    badge: "bg-bg-elevated/40 text-text-secondary border-border/40",
    bar: "bg-bg-elevated",
    text: "text-text-secondary",
  },
};
