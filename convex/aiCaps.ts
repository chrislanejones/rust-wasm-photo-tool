// AI job caps, decided by ENTITLEMENT, not by the raw `users.tier`.
//
// QC F3 (09-24-2026): an admin is entitled to paid (convex/entitlement.ts —
// "ADMIN IS ENTITLED TO PAID, server included"), and the UI gates on that. But
// `aiJobs.startJob` looked the caps up by `user.tier`, so an admin whose row
// still said "free" got cap 0 and "AI tools require a paid plan" from the same
// server that had just told the UI AI was unlocked. Two answers to one
// question; this is the one place the caps are decided now.
//
// Pure (no Convex runtime), so the rule is testable on its own.
import type { Entitlement } from "./entitlement";

export interface AiCaps {
  daily: number;
  monthly: number;
}

/** Per-tier caps for paying tiers. `pro` is also what an admin gets when
 *  the row itself holds no paid tier. */
export const AI_CAPS: Record<"pro" | "team", AiCaps> = {
  pro: { daily: 50, monthly: 300 },
  team: { daily: 200, monthly: 1500 },
};

const NONE: AiCaps = { daily: 0, monthly: 0 };

/** The caps for this person. Not entitled to paid → 0 (the gate). Entitled
 *  and the row is a paying tier → that tier's caps. Entitled without one (an
 *  admin on a free row) → Pro's. */
export function aiCapsFor(tier: string | null | undefined, entitlement: Entitlement): AiCaps {
  if (entitlement !== "paid") return NONE;
  if (tier === "team") return AI_CAPS.team;
  return AI_CAPS.pro;
}
