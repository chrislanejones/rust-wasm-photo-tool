// Who is using the app, as every tier gate should read it — and whether that
// is decided yet.
//
// Moved out of AppShell (Night 10-27): the Clerk mode watcher that used to be
// the `AuthModeWatcher` component, and the "who you are, and what you may see"
// block that turned it into `effectiveUserMode`.
//
// ADR: role, not a fourth tier. `session` comes from the SERVER (`users.me` →
// convex/entitlement.ts): the role from ADMIN_EMAILS, and the entitlement, in
// which an admin is entitled to paid WITHOUT a tier grant. The Super User
// preview may only TAKE AWAY (`effectiveMode` → `previewOf`), so the UI can
// never offer what the server would refuse.
//
// TIER PENDING (10-27-2026). Between "Clerk says signed in" and "`users.me`
// answered", the tier is unknown. The mode for that stretch is `loggedIn` —
// the lower tier is what is ALLOWED, and this file does not change that — but
// it used to also be what the UI SAID: a paid user saw "24 max", the OCR
// panel's "needs a Paid plan", and "Layer limit reached" for a beat, then the
// real answer. `tierPending` says "not decided yet", and the gates read it as
// "do not decide": the count shows a skeleton where the max goes, upgrade
// prompts stay hidden, and a cap that would refuse waits for the answer
// (`decideGalleryCap`, tierPending.ts). Only WHEN a gate decides changed,
// never WHAT a tier may do.
import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { CLOUD_CONFIGURED } from "@/lib/cloud";
import { logDiagnostic } from "@/lib/diagnosticsLog";
import { useStoreUser, useRealTier } from "@/hooks/useStoreUser";
import { useSession, effectiveMode } from "@/hooks/useEntitlement";
import { userModeForTier, type UserMode } from "@/lib/tiers";
import { useUIStore } from "@/stores/useUIStore";
import type { SuperUserControls } from "@/components/SuperUserPane";
import { TIER_PENDING_MAX_MS, type TierRef } from "./tierPending";

/** Clerk → the store's `userMode` and `tierPending`. Signed out is "demo";
 *  signed in reads the tier off the Convex users row. */
function useClerkUserMode(): void {
  const { isLoaded, isSignedIn } = useUser();
  // Create/refresh the Convex users row on sign-in (tier lives there)...
  useStoreUser();
  // ...and then actually READ that tier. Without this line a pro/team
  // subscriber was gated to free limits: the watcher created the row the tier
  // lives in and then reported `loggedIn` for every signed-in user.
  const realTier = useRealTier();
  const setUserMode = useUIStore((s) => s.setUserMode);
  const setAuthResolved = useUIStore((s) => s.setAuthResolved);
  const setTierPending = useUIStore((s) => s.setTierPending);

  // `undefined` = not answered (Convex auth still connecting, or the query in
  // flight). Signed out never waits: there is no tier to wait for.
  const waiting = !!(isLoaded && isSignedIn && realTier === undefined);
  // Latches for the session: once a tier has failed to answer in time, a later
  // wait (sign out, sign in) decides at once rather than hiding the max again.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!waiting || gaveUp) return;
    const t = window.setTimeout(() => {
      setGaveUp(true);
      logDiagnostic(
        "CONVEX_DB",
        `users.me did not answer in ${TIER_PENDING_MAX_MS} ms; deciding with the free tier`,
      );
    }, TIER_PENDING_MAX_MS);
    return () => window.clearTimeout(t);
  }, [waiting, gaveUp]);

  useEffect(() => {
    if (!isLoaded) return;
    setUserMode(isSignedIn ? userModeForTier(realTier) : "demo");
    setTierPending(waiting && !gaveUp);
    setAuthResolved(true);
  }, [isLoaded, isSignedIn, realTier, waiting, gaveUp, setUserMode, setTierPending, setAuthResolved]);
}

// Chosen once, at module load, like lib/cloud: Clerk's hooks throw without a
// provider, and a keyless build (the logged-out demo) renders none. That build
// never had a watcher, so `userMode` stays "demo", `authResolved` false and
// `tierPending` false — demo mode has no tier query and never waits.
const useAuthWatch: () => void = CLOUD_CONFIGURED ? useClerkUserMode : () => {};

export interface UserModeState {
  /** The rung every tier gate reads (Super User preview applied). While
   *  `tierPending`, the lower tier: what is allowed, not what to announce. */
  effectiveUserMode: UserMode;
  /** Signed in, tier not answered yet. Gates wait instead of refusing. */
  tierPending: boolean;
  /** For handlers that must answer a cap: see `decideGalleryCap`. */
  tierRef: TierRef;
  /** The Super User pane's controls; null for everyone but an admin. */
  superUser: SuperUserControls | null;
}

export function useUserMode(): UserModeState {
  useAuthWatch();
  const userMode = useUIStore((s) => s.userMode);
  const session = useSession();
  // `session.ready` lands in the same render as the tier (both read
  // `users.me`), a commit before the watcher's effect clears the flag.
  const tierPending = useUIStore((s) => s.tierPending) && !session.ready;
  const devTierOverride = useUIStore((s) => s.devTierOverride);
  const setDevTierOverride = useUIStore((s) => s.setDevTierOverride);
  // While Convex is still answering, fall back to the Clerk-derived mode so the
  // first paint is not "signed out" for someone who is signed in.
  const effectiveUserMode = session.ready
    ? effectiveMode(session, devTierOverride)
    : (devTierOverride ?? userMode);

  const tierRef = useRef({ mode: effectiveUserMode, pending: tierPending });
  useEffect(() => {
    tierRef.current = { mode: effectiveUserMode, pending: tierPending };
  }, [effectiveUserMode, tierPending]);

  const superUser: SuperUserControls | null = session.role === "admin"
    ? {
        mode: effectiveUserMode,
        overridden: devTierOverride !== null,
        onSelect: (m) => setDevTierOverride(m),
        onReset: () => setDevTierOverride(null),
        entitlement: session.entitlement,
      }
    : null;

  return { effectiveUserMode, tierPending, tierRef, superUser };
}
