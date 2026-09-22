// The one place that knows every runtime feature flag.
//
// Until now the seven `ih_*` switches were documented only in the comment at
// the top of whichever module read them, so "what flags exist and what am I
// running with?" had no answer short of grepping. This registry is that answer,
// and the Diagnostics Window renders it.
//
// IT DOES NOT REIMPLEMENT THE READS. Each entry points at the module's own
// exported predicate, so the panel cannot disagree with the behavior — a
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
// None of these is a user preference. The KILL switches have no Settings UI on
// purpose: they exist so one profile can turn a suspect subsystem off, and a
// person hunting for a setting must not find one.
//
// The OPT-IN ones do have a surface now — Settings › Beta (ADR-064), the ring
// of invited people who see a thing before everyone. An opt-in entry carries
// its `beta` block below and NOTHING ELSE MOVES: the key, and the module's own
// predicate, stay here, so the pane cannot drift from the behavior the way a
// second registry would. `lib/beta.ts` reads this list and never names a key.
//
// Every one of these still needs a reload to take full effect — the reads
// happen at module init or on paths that have already run.

import { isOplogPersistenceEnabled } from "@/lib/oplogPersistence";
import { isTilesFlushEnabled, isOplogUndoEnabled } from "@/lib/tilesFlush";
import { isPatchmatchEnabled } from "@/lib/patchmatch";
import { isSelectionBoolEnabled } from "@/lib/selectionBool";
import { isSmartEdgeEnabled } from "@/lib/smartEdge";
import { isUploadRetryEnabled } from "@/lib/uploadBudget";
import { webgpuEnabled } from "@/lib/webgpu/detect";
import { engineWorkerEnabled } from "@/lib/engine/port";

export type FlagKind = "kill" | "optin";

/** What Settings › Beta shows for an opt-in flag. Its presence is what puts a
 *  flag in the ring; a flag without it is DevTools-only. The key and the read
 *  stay on the FeatureFlag itself — see the header. */
export interface BetaListing {
  /** URL-safe id, the spelling that goes in `?beta=`. */
  id: string;
  /** The name a person outside this repo would use. `label` above is the
   *  developer's name for the same thing, and the Diagnostics panel shows it. */
  label: string;
  /** One sentence: what it does, and what is unfinished about it. */
  blurb: string;
}

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
  /** Present ⇒ this opt-in is offered in Settings › Beta. Kill switches never
   *  carry one: turning a shipped subsystem off is not a beta feature. */
  beta?: BetaListing;
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
      "Re-attempts a cloud upload the rate limiter denied, once, after the interval expires. Off restores v7.67 behavior: a denied upload is skipped and never retried. The local copy is written either way, so this only affects cloud freshness.",
    source: "lib/uploadBudget.ts",
  },
  {
    key: "ih_smart_edge",
    label: "Smart Brush (edge-aware)",
    kind: "optin",
    isOn: isSmartEdgeEnabled,
    effect: "Edge-aware brush snapping. Kernels are tested and wired but the FEEL has never been signed off on a real canvas (ADR-014).",
    source: "lib/smartEdge.ts",
    beta: {
      id: "smart-brush",
      label: "Smart Brush",
      blurb:
        "Paint strokes that stop at an edge instead of running over it. The engine side is tested; what nobody has judged is the feel — whether a stroke stops where you expect.",
    },
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
    // ⚠️ This line said "no pixel in the app goes near the GPU yet" until
    // 09-22-2026. It had been true, and stopped being true when the whole-image
    // blur grew its GPU path in `useTransforms.ts` — the registry's own comment
    // asks for a row per flag and cannot notice a row going stale.
    effect: "Whole-image blur runs through WebGPU when the adapter is real hardware, and falls back to the CPU on any failure (useTransforms.ts, ADR-030). Also attaches the correctness harness, window.__ihGpuBlurSelfTest(). The effects BRUSH is always CPU — its dabs are below the transfer floor.",
    source: "lib/webgpu/detect.ts",
    beta: {
      id: "gpu-blur",
      label: "Blur on the graphics card",
      blurb:
        "Runs a whole-image blur through WebGPU when your machine has real graphics hardware, instead of the CPU. Measured faster on one image at a time; a software adapter is refused, and any failure falls back to the CPU.",
    },
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
