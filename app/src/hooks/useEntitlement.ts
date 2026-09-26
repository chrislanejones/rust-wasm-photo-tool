// What this session may use, as the SERVER sees it.
//
// The browser used to answer two of these questions itself: whether you are an
// admin (comparing your email to a hardcoded address in `lib/superuser.ts`) and
// what tier you are on. Both now come from `users.me`, which computes them with
// `convex/entitlement.ts` — the same module this file imports for the preview
// rule. One implementation, so the UI and the mutations cannot disagree about
// who may do what.
//
// THE PREVIEW CAN ONLY TAKE AWAY. An admin may look at the app as "free" or
// "signed out" to check those views; nobody can look at a rung above their own.
// That is what keeps the UI honest: what you see is always something the server
// would allow (`previewOf`).
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  entitlementOf,
  fromUserMode,
  previewOf,
  toUserMode,
  type Entitlement,
  type Role,
  type UserModeName,
} from "../../../convex/entitlement";

export interface Session {
  /** Trust, not a purchase. Decided by the server from ADMIN_EMAILS. */
  role: Role;
  /** What this session may use, before any preview. */
  entitlement: Entitlement;
  /** The real tier on the account row, for display ("free" while signed out). */
  tier: string | null;
  /** False while Convex is still answering — gates should wait, not refuse. */
  ready: boolean;
}

/** Role + entitlement, live. Re-renders when a grant lands, no reload. */
export function useSession(): Session {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");

  if (!isAuthenticated) {
    return {
      role: "user",
      entitlement: "none",
      tier: null,
      // Signed out is an answer, not a wait — unless Clerk is still deciding.
      ready: !isLoading,
    };
  }
  if (me === undefined) {
    return { role: "user", entitlement: "none", tier: null, ready: false };
  }
  // `me` carries role and entitlement computed server-side; the fallback keeps
  // a client running against an older deployment on the same ladder rather
  // than crashing or silently granting.
  const role: Role = me?.role ?? "user";
  return {
    role,
    entitlement: me?.entitlement ?? entitlementOf(me?.tier, role, true),
    tier: me?.tier ?? null,
    ready: true,
  };
}

/**
 * The rung the UI should draw, given the Super User preview.
 *
 * Returns the app's older `UserMode` vocabulary ("demo" | "loggedIn" | "paid")
 * because the tier table, status bar and caps all speak it.
 */
export function effectiveMode(
  session: Session,
  preview: UserModeName | null,
): UserModeName {
  return toUserMode(
    previewOf(preview === null ? null : fromUserMode(preview), session.entitlement),
  );
}
