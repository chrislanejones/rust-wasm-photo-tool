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

interface TierConfig {
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
    // Layers are a fundamental, purely client-side editing tool (the Rust
    // layer stack lives entirely in-memory / IndexedDB), so they are NOT
    // paywalled — the no-login tier gets the same allowance as Logged In.
    // Login/paid differentiate on CLOUD features (storage, gallery cap,
    // sharing, AI), not on local editing.
    //
    // 3 → 8 on 2026-08-18: three was a limit people hit while doing ordinary
    // work, which made it feel like a paywall rather than a ceiling. Paid goes
    // to 16 rather than Infinity — see the `paid` entry.
    layersPerImage: 8,
    layersShort: "8",
    layersLabel: "8 per image",
    replicateAI: false,
  },
  loggedIn: {
    label: "Logged In",
    tag: "free",
    galleryLimit: 24,
    storageQuotaBytes: 100 * MB,
    storageLabel: "100 MB",
    layersPerImage: 8,
    layersShort: "8",
    layersLabel: "8 per image",
    replicateAI: false,
  },
  paid: {
    label: "Paid",
    tag: "$10/mo",
    galleryLimit: 100,
    storageQuotaBytes: 5 * GB,
    storageLabel: "5 GB",
    // 16, NOT Infinity (changed 2026-08-18). Unlimited was never really
    // unlimited: an .ora export holds every layer's pixels at once, and wasm
    // memory never shrinks, so the tail of that promise landed on the paying
    // user as a tab that ran out of memory. A stated ceiling is the honest
    // version of a limit the machine was already imposing.
    layersPerImage: 16,
    layersShort: "16",
    layersLabel: "16 per image",
    replicateAI: true,
  },
};

/** Replicate AI is a Paid-only feature. */
export const hasReplicateAI = (mode: UserMode): boolean => TIERS[mode].replicateAI;

/** Convex `users.tier` → the UI's `UserMode`.
 *
 *  Two vocabularies exist for one concept: the server stores
 *  `"free" | "pro" | "team"` (convex/schema.ts) and the client gates on
 *  `"demo" | "loggedIn" | "paid"`. Nothing translated between them, which is
 *  how paid accounts ended up capped at free limits — see the fix at
 *  `AuthModeWatcher` in AppShell.
 *
 *  `null` means "signed in, tier not resolved yet" (the Convex query is in
 *  flight) and deliberately maps to `loggedIn`, NOT `paid`: erring toward the
 *  lower tier means a free user never sees a flash of paid features, and a paid
 *  user upgrades a tick later when the query lands. The query is reactive, so a
 *  tier grant or upgrade flips the UI live with no reload. */
export function userModeForTier(tier: string | null | undefined): UserMode {
  return tier === "pro" || tier === "team" ? "paid" : "loggedIn";
}
