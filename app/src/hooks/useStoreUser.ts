// app/src/hooks/useStoreUser.ts
import { useUser } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { api } from "../../../.convex/_generated/api";
import { useEffect } from "react";

/**
 * Syncs the signed-in Clerk user into the Convex users table.
 * The upsert mutation is idempotent — safe to fire on every mount.
 * Call once near the app root.
 */
export function useStoreUser() {
  const { isSignedIn, user } = useUser();
  const upsertUser = useMutation(api.users.upsert);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    void upsertUser();
  }, [isSignedIn, user, upsertUser]);
}
