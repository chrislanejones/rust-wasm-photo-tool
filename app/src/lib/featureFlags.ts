// The one place that knows every runtime feature flag.
//
// Until now the seven `ih_*` switches were documented only in the comment at
// the top of whichever module read them, so "what flags exist and what am I
// running with?" had no answer short of grepping. This registry is that answer,
// and the Diagnostics Window renders it.
//
// IT DOES NOT REIMPLEMENT THE READS. Each entry points at the module's own
// exported predicate, so the panel cannot disagree with the behaviour — a
// second copy of `getItem(...) !== "0"` here would be a new source of truth
// that silently drifts, which is the exact failure this repo keeps hitting.
// Adding a flag means adding a row here; the compiler will not force you, so
// this comment is the only guard.
//
// Two shapes exist and the difference matters when reading the panel:
//
//   • KILL SWITCH  — default ON, `"0"` disables. Used for things that shipped
//     and are now load-bearing; the switch exists so one profile can turn a
//     suspect subsystem off without a deploy.
//   • OPT-IN       — default OFF, `"1"` enables. Used for things that have not
//     earned trust yet.
//
// None of these are user preferences. There is deliberately no Settings UI —
// they are set from DevTools and every one needs a reload to take effect,
// because the reads happen at module init or on paths that have already run.

import { isOplogPersistenceEnabled } from "@/lib/oplogPersistence";
import { isTilesFlushEnabled, isOplogUndoEnabled } from "@/lib/tilesFlush";
import { isPatchmatchEnabled } from "@/lib/patchmatch";
import { isSelectionBoolEnabled } from "@/lib/selectionBool";
import { isSmartEdgeEnabled } from "@/lib/smartEdge";
import { isUploadRetryEnabled } from "@/lib/uploadBudget";
import { webgpuEnabled } from "@/lib/webgpu/detect";
import { engineWorkerEnabled } from "@/lib/engine/port";

export type FlagKind = "kill" | "optin";

export interface FeatureFlag {
  /** The localStorage key, exactly as you would type it in DevTools. */
  key: string;
  label: string;
  kind: FlagKind;
  /** The module's OWN predicate — never a reimplementation. */
  isOn: () => boolean;
  /** One line: what turning this off (kill) or on (opt-in) actually does. */
  effect: string;
  /** Where it is read, so the panel can send you to the source. */
  source: string;
}

export const FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: "ih_tiles_flush",
    label: "Tile flush",
    kind: "kill",
    isOn: isTilesFlushEnabled,
    effect: "Dirty-tile canvas flush. Off falls back to full-frame blits — slower, never wrong.",
    source: "lib/tilesFlush.ts",
  },
  {
    key: "ih_oplog_undo",
    label: "Op-log undo",
    kind: "kill",
    isOn: isOplogUndoEnabled,
    effect: "Undo/redo replays the op log instead of snapshots. Recording happens either way; a hash mismatch already falls back on its own (ADR-013).",
    source: "lib/tilesFlush.ts",
  },
  {
    key: "ih_oplog_persist",
    label: "Op-log persistence",
    kind: "kill",
    isOn: isOplogPersistenceEnabled,
    effect: "Persists the op log to IndexedDB. Off makes the module inert and the older persistence carries everything (ADR-017).",
    source: "lib/oplogPersistence.ts",
  },
  {
    key: "ih_patchmatch",
    label: "Magic Eraser (PatchMatch)",
    kind: "kill",
    isOn: isPatchmatchEnabled,
    effect: "Remove Object. Off hides the feature entirely rather than failing at the call — also the fallback when an older cached wasm lacks the export.",
    source: "lib/patchmatch.ts",
  },
  {
    key: "ih_selection_bool",
    label: "Selection booleans",
    kind: "kill",
    isOn: isSelectionBoolEnabled,
    effect: "Add/subtract/intersect when combining selections. Off means each new selection replaces the last.",
    source: "lib/selectionBool.ts",
  },
  {
    key: "ih_upload_retry",
    label: "Deferred upload retry",
    kind: "kill",
    isOn: isUploadRetryEnabled,
    effect:
      "Re-attempts a cloud upload the rate limiter denied, once, after the interval expires. Off restores v7.67 behaviour: a denied upload is skipped and never retried. The local copy is written either way, so this only affects cloud freshness.",
    source: "lib/uploadBudget.ts",
  },
  {
    key: "ih_smart_edge",
    label: "Smart Brush (edge-aware)",
    kind: "optin",
    isOn: isSmartEdgeEnabled,
    effect: "Edge-aware brush snapping. Kernels are tested and wired but the FEEL has never been signed off on a real canvas (ADR-014).",
    source: "lib/smartEdge.ts",
  },
  {
    key: "ih_engine_worker",
    label: "Engine in a Worker (ADR-024)",
    kind: "kill",
    isOn: engineWorkerEnabled,
    effect: "The engine runs on a background thread and draws the photo from there — heavy operations no longer block the interface (measured: 129–137 ms of blocking per sharpen down to 0). Off falls back to the main-thread engine: slower under load, never wrong. Takes effect on the next load, like every kill switch here.",
    source: "lib/engine/port.ts",
  },
  {
    key: "ih_webgpu",
    label: "WebGPU (Phase 0)",
    kind: "optin",
    isOn: webgpuEnabled,
    effect: "Attaches the GPU blur correctness harness. No pixel in the app goes near the GPU yet — this only exposes window.__ihGpuBlurSelfTest() (ADR-030).",
    source: "lib/webgpu/detect.ts",
  },
];

/** Raw stored value, or null when the key was never set. */
export function rawFlagValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Is this flag at its shipped default, or has this profile overridden it? */
export function isOverridden(flag: FeatureFlag): boolean {
  const raw = rawFlagValue(flag.key);
  if (raw === null) return false;
  return flag.kind === "kill" ? raw === "0" : raw === "1";
}

/** Set a flag to its non-default value, or clear the override. */
export function setFlagOverride(flag: FeatureFlag, override: boolean): void {
  try {
    if (!override) localStorage.removeItem(flag.key);
    else localStorage.setItem(flag.key, flag.kind === "kill" ? "0" : "1");
  } catch {
    /* storage blocked — the panel reports the read-back, so this shows up */
  }
}
