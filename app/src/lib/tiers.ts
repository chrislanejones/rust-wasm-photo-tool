// app/src/lib/tiers.ts
//
// Single source of truth for per-tier capabilities. This is "how tiers are
// done": one config object keyed by account tier, and every feature reads its
// limit from here instead of hardcoding numbers in components.
//
// Tiers mirror the public pricing matrix on the marketing site
// (marketing/src/sections/Pricing.tsx). The gallery photo cap ALSO lives in
// Rust (`photo_limit` in src/lib.rs) for the WASM layer — keep the two in sync;
// `galleryLimit` here must equal what `photo_limit` returns.
import type { UserMode } from "@/components/StatusBar";

export interface TierConfig {
  /** Switcher / UI label, e.g. "No Login". */
  label: string;
  /** Small qualifier, e.g. "anonymous" / "free" / "$10/mo". */
  tag: string;
  /** Photos loaded per session. Mirrors Rust `photo_limit`. */
  galleryLimit: number;
  /** Persistent file-storage cap in bytes; null = no persistence. */
  storageQuotaBytes: number | null;
  /** Display string for storage, e.g. "—" / "100 MB" / "5 GB". */
  storageLabel: string;
  /** Layers allowed per image. 0 = none, Infinity = unlimited. */
  layersPerImage: number;
  /** Compact layer display for a number box: "—" / "3" / "∞". */
  layersShort: string;
  /** Full layer display: "—" / "3 per image" / "unlimited". */
  layersLabel: string;
  /** Whether Replicate-backed AI tools are available. Paid only. */
  replicateAI: boolean;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const TIERS: Record<UserMode, TierConfig> = {
  demo: {
    label: "No Login",
    tag: "anonymous",
    galleryLimit: 12,
    storageQuotaBytes: null,
    storageLabel: "—",
    layersPerImage: 0,
    layersShort: "—",
    layersLabel: "—",
    replicateAI: false,
  },
  loggedIn: {
    label: "Logged In",
    tag: "free",
    galleryLimit: 24,
    storageQuotaBytes: 100 * MB,
    storageLabel: "100 MB",
    layersPerImage: 3,
    layersShort: "3",
    layersLabel: "3 per image",
    replicateAI: false,
  },
  paid: {
    label: "Paid",
    tag: "$10/mo",
    galleryLimit: 100,
    storageQuotaBytes: 5 * GB,
    storageLabel: "5 GB",
    layersPerImage: Infinity,
    layersShort: "∞",
    layersLabel: "unlimited",
    replicateAI: true,
  },
};

export const tierFor = (mode: UserMode): TierConfig => TIERS[mode];
export const galleryLimitFor = (mode: UserMode): number => TIERS[mode].galleryLimit;
export const layerLimitFor = (mode: UserMode): number => TIERS[mode].layersPerImage;
/** Replicate AI is a Paid-only feature. */
export const hasReplicateAI = (mode: UserMode): boolean => TIERS[mode].replicateAI;
