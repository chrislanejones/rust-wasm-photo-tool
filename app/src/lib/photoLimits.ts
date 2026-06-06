// app/src/lib/photoLimits.ts
//
// Gallery photo caps per account tier. The numbers live in Rust
// (`photo_limit` in src/lib.rs) so there is a single source of truth shared
// by the WASM layer and the UI. This module just ensures the wasm module is
// initialized and forwards the lookup.
import type { UserMode } from "@/components/StatusBar";

/** Most-restrictive cap, used as the initial value before WASM resolves. */
export const DEFAULT_PHOTO_LIMIT = 12;

/**
 * Resolve the gallery photo cap for a tier from the Rust/WASM source of truth.
 * Async: it lazily initializes the wasm module (same pattern as the editing
 * hooks) before calling the exported `photo_limit` function.
 */
export async function getPhotoLimit(mode: UserMode): Promise<number> {
  const mod = await import("stamp_tool");
  await mod.default();
  return mod.photo_limit(mode);
}
