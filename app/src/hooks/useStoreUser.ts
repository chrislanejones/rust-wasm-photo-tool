import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { logDiagnostic } from "@/lib/diagnosticsLog";

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
