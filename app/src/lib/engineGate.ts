// The phone does not load the engine.
//
// `features/mobile/MobileShell.tsx` permits no editing — upload, grid, viewer,
// Download, Delete — and none of it needs the ~830 KB WASM engine. So below
// BP_MOBILE at boot the engine is simply not imported; the only value the phone
// needs from Rust, `photo_limit`, is mirrored in lib/tiers.ts.
//
// WANTED LATCHES. It starts false below BP_MOBILE and becomes true the first
// time the window is that wide, and never goes back: an engine that is already
// loaded keeps running when the window narrows (the phone layer sits on top of
// the editor, exactly as before), and tearing it down would lose the document.
//
// A module, not React state, on purpose: `useImageSession`'s callbacks, the
// boot sequence and the warm-ups all need the answer outside a render, and the
// resize listener must exist before the first component mounts or a window
// widened during boot would be missed. The hooks are app/session/useEngineGate.
import { BP_MOBILE } from "@/lib/layout";

const wide = () => typeof window === "undefined" || window.innerWidth >= BP_MOBILE;

let wanted = wide();
const listeners = new Set<() => void>();

if (!wanted) {
  const onResize = () => {
    if (!wide()) return;
    wanted = true;
    window.removeEventListener("resize", onResize);
    listeners.forEach((l) => l());
  };
  window.addEventListener("resize", onResize);
}

/** Has the window ever been wide enough to edit? Readable outside React. */
export const engineWanted = (): boolean => wanted;

/** Subscribe to the flip to wanted. Returns the unsubscribe. */
export function subscribeEngineWanted(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Resolves once the engine is wanted — immediately on a desktop, on widening
 *  for a phone. For warm-ups that should run "when the editor exists". */
export function whenEngineWanted(): Promise<void> {
  if (wanted) return Promise.resolve();
  return new Promise((resolve) => {
    const off = subscribeEngineWanted(() => {
      off();
      resolve();
    });
  });
}

/** The initialised engine module, for the app's lazy readers (grid geometry,
 *  colour parsing, the undo budget…). Waits until the engine is wanted, so a
 *  phone that mounts one of them does not become the thing that loads it. */
export async function importEngine(): Promise<typeof import("stamp_tool")> {
  await whenEngineWanted();
  const mod = await import("stamp_tool");
  await mod.default();
  return mod;
}

/** Import + initialise the engine, unless this is a phone (then: nothing).
 *  Idempotent — the module and its init are cached by the loader. */
export async function loadEngineIfWanted(): Promise<void> {
  if (!wanted) return;
  const mod = await import("stamp_tool");
  await mod.default();
}
