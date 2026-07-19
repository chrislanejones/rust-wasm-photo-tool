/// <reference types="vite/client" />

// Build-time constants injected via `define` in vite.config.ts (mirrored in
// vitest.config.ts for the node test environment). __IH_SW_MODE__ defaults
// to "off" — service-worker code paths are dead code unless VITE_ENABLE_SW
// was set when the build ran (see the comment block in vite.config.ts).
declare const __IH_SW_MODE__: "off" | "on" | "kill";
// Per-build hash for the skew guard (lib/pwa/skew.ts) — compared against the
// network-only version.json emitted by SW-enabled builds.
declare const __IH_BUILD_HASH__: string;
