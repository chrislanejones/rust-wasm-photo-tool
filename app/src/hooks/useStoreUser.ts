import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { logDiagnostic } from "@/lib/diagnosticsLog";

/**
 * The signed-in user's REAL tier from their Convex users row (null while
 * logged out / loading). This is what lifts the client's user mode to "paid"
 * for actual pro/team accounts — without it, tier gating (the AI panel, caps)
 * only ever saw "loggedIn" and paid features stayed locked in the UI even
 * though the server would have allowed them. Reactive: a tier grant or
 * upgrade flips the UI live, no reload.
 */
export function useRealTier(): string | null {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  return me?.tier ?? null;
}

/**
 * Ensure a Convex `users` row exists for the signed-in Clerk user.
 *
 * `users.upsert` reads the Clerk identity server-side, so it must only run once
 * Convex itself is authenticated (not merely when Clerk says signed-in — the
 * Convex JWT bridge lags a tick). Without this, a login never creates a user
 * row, so tier / subscription / AI-gating have nothing to read.
 */
export function useStoreUser() {
  const { isAuthenticated } = useConvexAuth();
  const upsert = useMutation(api.users.upsert);
  const stored = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      stored.current = false;
      return;
    }
    if (stored.current) return;
    stored.current = true;
    void upsert().catch((err) => {
      // Allow a retry on the next auth change if the upsert failed — and surface
      // it: a failed upsert means the user row never gets created, so tier /
      // subscription / AI-gating silently have nothing to read.
      stored.current = false;
      logDiagnostic(
        "CONVEX_DB",
        `users.upsert failed (user row not created): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }, [isAuthenticated, upsert]);
}
