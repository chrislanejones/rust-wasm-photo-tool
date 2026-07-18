// PatchMatch object removal — verification switch, NOT a shipped preference.
//
// `remove_object` only exists on a wasm build compiled with
// `--features patchmatch` (see Cargo.toml's `patchmatch` feature comment) —
// the default, shipped `pkg/` never has it. Deliberately NOT added to the
// shared ambient `app/src/hooks/stamp_tool.d.ts` (which describes what the
// shipped build actually has) — same precedent as `tilesFlush.ts`'s
// TilesWasmExports/OplogWasmExports — so feature-detect at runtime via a
// local interface + cast instead of widening the ambient surface to
// something that isn't always true.
//
// Runtime toggle: `localStorage.setItem("ih_patchmatch", "1")` in DevTools,
// then reload. Same pattern as `ih_smart_edge`/`ih_tiles_flush` — there is
// deliberately no Settings-panel UI for it.
//
// With the switch OFF (the default), Remove Object doesn't even render in
// Adjust & Select → Select — see SelectSettings.tsx — so the engine call
// below is never reached and a default (non-`patchmatch`) wasm build is
// never asked to run code it doesn't have.

export interface PatchmatchWasmExports {
  remove_object(): boolean;
}

function hasPatchmatchExports(t: object): t is PatchmatchWasmExports {
  return (
    typeof (t as Partial<PatchmatchWasmExports>).remove_object === "function"
  );
}

/** Whether the PatchMatch object-removal kernel is unlocked (see module doc
 *  above). */
export function isPatchmatchEnabled(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem("ih_patchmatch") === "1"
    );
  } catch {
    return false;
  }
}

/**
 * Run Remove Object if (a) the switch is on and (b) this wasm build actually
 * has the export (a default, non-`patchmatch` build never does). Returns
 * whether something was actually removed — `false` if the switch is off, the
 * build lacks the export, or there was nothing selected, all of which are
 * safe no-ops (nothing on the canvas changes).
 */
export function tryRemoveObject(tool: object): boolean {
  if (!isPatchmatchEnabled() || !hasPatchmatchExports(tool)) return false;
  return tool.remove_object();
}
