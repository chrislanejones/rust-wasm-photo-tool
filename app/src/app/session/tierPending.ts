// The tier-pending rules that are not React: how long to wait, and how a cap
// is decided while waiting. The hook that sets the flag is useUserMode.ts;
// this half is separate so a handler can use it without importing Clerk.
import type { RefObject } from "react";
import { TIERS, type UserMode } from "@/lib/tiers";

/** A tier that has not answered by now never will (Convex auth refused, the
 *  network died): stop waiting and decide with the lower tier — exactly what
 *  the app did before pending existed. Like GALLERY_LOADING_MAX_MS, a wait
 *  must not become a lock. */
export const TIER_PENDING_MAX_MS = 10_000;

/** What an async handler reads AFTER an await: the latest render's answer. */
export type TierRef = RefObject<{ mode: UserMode; pending: boolean }>;

/** User-facing message when the gallery cap is reached, nudging toward the next tier.
 *  One copy: AppShell and useImageSession each had their own. Only ever shown
 *  for a DECIDED tier — see `decideGalleryCap`. */
export function capMessage(mode: UserMode, max: number): string {
  if (mode === "demo")
    return `Demo galleries hold ${max} photos. Sign in to load up to 24.`;
  if (mode === "loggedIn")
    return `Free accounts hold ${max} photos. Pro (100) is coming soon.`;
  return `Gallery is limited to ${max} photos.`;
}

/**
 * The gallery cap to enforce when the gallery would hold `wanted` photos.
 *
 * If that fits under the cap in force, or the tier is decided, the answer is
 * the cap in force — no wait, the common case. Otherwise the lower tier would
 * REFUSE while the real one may not: wait for the tier (bounded by
 * TIER_PENDING_MAX_MS), then answer with the decided tier's cap. A paid user's
 * 30-photo drop in the first second is no longer trimmed to 24 with a
 * "Free accounts hold 24 photos" toast.
 *
 * TIERS' `galleryLimit` mirrors Rust `photo_limit` (tiers.ts), and is what
 * usePhotoLimit sets first, so reading it here agrees with the store.
 */
export async function decideGalleryCap(
  tier: TierRef,
  now: { mode: UserMode; max: number },
  wanted: number,
): Promise<{ mode: UserMode; max: number }> {
  if (wanted <= now.max || !tier.current.pending) return now;
  const deadline = Date.now() + TIER_PENDING_MAX_MS;
  while (tier.current.pending && Date.now() < deadline) {
    await new Promise((r) => window.setTimeout(r, 50));
  }
  if (tier.current.pending) return now;
  const mode = tier.current.mode;
  return { mode, max: TIERS[mode].galleryLimit };
}
