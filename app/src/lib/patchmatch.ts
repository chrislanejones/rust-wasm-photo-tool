// PatchMatch object removal — SHIPPED ON since the v7.46 launch (Chris:
// "it's not the best tool in the world but let's launch it").
//
// `remove_object` only exists on a wasm build compiled with
// `--features patchmatch`; since v7.46 the shipped build IS one
// (`build:wasm` and netlify.toml both pass `tiles,patchmatch`). The export
// stays deliberately OUT of the shared ambient `app/src/hooks/stamp_tool.d.ts`
// — the runtime feature-detect below is the skew guard: a user still holding
// an older cached wasm simply doesn't see Remove Object, instead of calling
// an export that isn't there. Same precedent as `tilesFlush.ts`'s
// TilesWasmExports/OplogWasmExports.
//
// `ih_patchmatch` is a KILL SWITCH now, not an opt-in:
// `localStorage.setItem("ih_patchmatch", "0")` + reload disables the feature
// (the defaults-ON-with-"0"-kill pattern of the v7.36 op-log flags and
// `ih_selection_bool`). There is deliberately no Settings-panel UI for it.
//
// With the switch killed (or the export absent), Remove Object doesn't render
// anywhere — see SelectSettings.tsx / AISettings.tsx — so the engine call
// below is never reached on a build that can't run it.

export interface PatchmatchWasmExports {
  remove_object(): boolean;
}

function hasPatchmatchExports(t: object): t is PatchmatchWasmExports {
  return (
    typeof (t as Partial<PatchmatchWasmExports>).remove_object === "function"
  );
}

/** Whether PatchMatch object removal is active — ON unless killed with the
 *  "0" switch (see module doc above). The wasm-export feature-detect in
 *  `tryRemoveObject` still guards the actual call on skewed builds. */
export function isPatchmatchEnabled(): boolean {
  try {
    return (
      typeof window === "undefined" ||
      window.localStorage.getItem("ih_patchmatch") !== "0"
    );
  } catch {
    return true;
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
