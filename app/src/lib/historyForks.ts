// Beta: history forks (`ih_history_forks`, ADR-086).
//
// OFF — the default, and everyone who has not opted in — is the old behavior
// exactly: an edit made after an undo clears the redo steps, as it always has.
// ON, the engine keeps those steps as a branch you can go back to, listed under
// History in the Review panel.
//
// The switch lives in the ENGINE (`set_history_forks`), because the engine is
// what decides whether redo is cleared or kept. This module only answers "is
// it on for this device?" and hands that to the engine: at every engine start
// (`useEngineCore`, every `createLiveEngine`) and on toggle (`useHistory`).
//
// Nothing here is persisted beyond the localStorage switch itself. Branches
// live in engine memory and go with the document.
import type { ImageHorseTool } from "stamp_tool";

/** The registry row's own predicate — see `featureFlags.ts`. */
export function isHistoryForksEnabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem("ih_history_forks") === "1";
  } catch {
    return false;
  }
}

/** The engine surface this needs. Optional on purpose: an older cached wasm
 *  without the export must keep working, with forks simply unavailable. */
interface ForksEngine {
  set_history_forks?: (on: boolean) => void | Promise<void>;
}

/** Push the device's switch into an engine and hand the engine back, so it
 *  chains onto `createLiveEngine(...)` without a new line at the call site. */
export async function withHistoryForks(tool: ImageHorseTool): Promise<ImageHorseTool> {
  await applyHistoryForks(tool);
  return tool;
}

/** Push the switch into a live engine. Never throws. */
export async function applyHistoryForks(tool: ForksEngine | null | undefined): Promise<void> {
  if (!tool || typeof tool.set_history_forks !== "function") return;
  try {
    await tool.set_history_forks(isHistoryForksEnabled());
  } catch {
    // An engine replaced mid-call, or one without the export: forks stay off,
    // which is the behavior everyone else has.
  }
}

/** One abandoned timeline, mirrored from the engine's `branches_json`. */
export interface HistoryBranch {
  /** Engine-side id — what `restore_history_branch` / `delete_history_branch`
   *  take. Never reused within a session. */
  id: number;
  /** The tip's label: the last thing done on that timeline. */
  label: string;
  /** How many steps it holds. */
  steps: number;
  /** Heap bytes it costs. Branches share the undo budget and lose it first. */
  bytes: number;
  /** True when it forks off ANOTHER branch rather than the live timeline. */
  nested: boolean;
}

const NO_BRANCHES: HistoryBranch[] = [];

/** Parse `branches_json`. `"[]"` — the constant the engine returns whenever
 *  nothing is held, which is always with the Beta off — costs no parse and
 *  returns one shared empty array, so the store sees no change. */
export function parseBranches(json: string | undefined): HistoryBranch[] {
  if (!json || json === "[]") return NO_BRANCHES;
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as HistoryBranch[]) : NO_BRANCHES;
  } catch {
    return NO_BRANCHES;
  }
}
