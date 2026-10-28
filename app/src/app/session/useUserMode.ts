// Who is using the app, as every tier gate should read it.
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
import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { CLOUD_CONFIGURED } from "@/lib/cloud";
import { useStoreUser, useRealTier } from "@/hooks/useStoreUser";
import { useSession, effectiveMode } from "@/hooks/useEntitlement";
import { userModeForTier, type UserMode } from "@/lib/tiers";
import { useUIStore } from "@/stores/useUIStore";
import type { SuperUserControls } from "@/components/SuperUserPane";

/** Clerk → the store's `userMode`. Signed out is "demo"; signed in reads the
 *  tier off the Convex users row. */
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

  useEffect(() => {
    if (!isLoaded) return;
    setUserMode(isSignedIn ? userModeForTier(realTier) : "demo");
    setAuthResolved(true);
  }, [isLoaded, isSignedIn, realTier, setUserMode, setAuthResolved]);
}

// Chosen once, at module load, like lib/cloud: Clerk's hooks throw without a
// provider, and a keyless build (the logged-out demo) renders none. That build
// never had a watcher, so `userMode` stays "demo" and `authResolved` false.
const useAuthWatch: () => void = CLOUD_CONFIGURED ? useClerkUserMode : () => {};

export interface UserModeState {
  /** The rung every tier gate reads (Super User preview applied). */
  effectiveUserMode: UserMode;
  /** The Super User pane's controls; null for everyone but an admin. */
  superUser: SuperUserControls | null;
}

export function useUserMode(): UserModeState {
  useAuthWatch();
  const userMode = useUIStore((s) => s.userMode);
  const session = useSession();
  const devTierOverride = useUIStore((s) => s.devTierOverride);
  const setDevTierOverride = useUIStore((s) => s.setDevTierOverride);
  // While Convex is still answering, fall back to the Clerk-derived mode so the
  // first paint is not "signed out" for someone who is signed in.
  const effectiveUserMode = session.ready
    ? effectiveMode(session, devTierOverride)
    : (devTierOverride ?? userMode);

  const superUser: SuperUserControls | null = session.role === "admin"
    ? {
        mode: effectiveUserMode,
        overridden: devTierOverride !== null,
        onSelect: (m) => setDevTierOverride(m),
        onReset: () => setDevTierOverride(null),
        entitlement: session.entitlement,
      }
    : null;

  return { effectiveUserMode, superUser };
}
