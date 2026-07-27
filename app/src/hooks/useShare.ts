import { useCallback } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/** Build the public share URL for a token, anchored to wherever the app is
 *  served (origin + path, so it works on localhost and any deploy host). */
function shareUrlFor(token: string): string {
  return `${window.location.origin}${window.location.pathname}?v=${token}`;
}

interface CreateShareInput {
  /** Flattened canvas snapshot (PNG). */
  blob: Blob;
  canvasW: number;
  canvasH: number;
  /** Optional human label (e.g. the photo's filename). */
  title?: string;
}

/** Why sharing is unavailable, when it is. "Not authenticated" was being
 *  reported as "signed out", which is a different thing and was a lie for the
 *  case that actually happens: Clerk signs you in, Convex rejects the token,
 *  and the button tells a signed-in user to sign in. */
export type ShareAvailability =
  | "ready"
  | "connecting" // Convex handshake still in flight — not an answer yet
  | "signed-out" // genuinely nobody signed in
  | "backend-rejected"; // signed in with Clerk, Convex would not accept it

/** Is a Clerk session present? Read off the global rather than `useAuth()` on
 *  purpose: ShareButton renders in demo mode, where `ConvexClerkProvider`
 *  mounts NO ClerkProvider, and Clerk's hooks throw outside one. Demo mode is
 *  a project invariant, so this must not be able to break it. Optional chaining
 *  gives the correct answer (false) when Clerk was never loaded. */
function clerkSessionPresent(): boolean {
  return !!(globalThis as { Clerk?: { user?: unknown } }).Clerk?.user;
}

/** Create-side of share links: upload a flattened PNG snapshot to Convex
 *  storage, mint a token, and hand back a ready-to-copy public URL.
 *  Requires a signed-in user (the upload URL is auth-gated). */
export function useShare() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const generateUploadUrl = useMutation(api.shares.generateUploadUrl);
  const createShareMutation = useMutation(api.shares.create);

  const createShare = useCallback(
    async (input: CreateShareInput): Promise<{ url: string; token: string }> => {
      const uploadUrl = await generateUploadUrl();
      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: input.blob,
      });
      if (!resp.ok) throw new Error(`Snapshot upload failed (${resp.status})`);
      const { storageId } = (await resp.json()) as { storageId: string };

      const { token } = await createShareMutation({
        storageId: storageId as Id<"_storage">,
        canvasW: input.canvasW,
        canvasH: input.canvasH,
        title: input.title,
      });
      return { url: shareUrlFor(token), token };
    },
    [generateUploadUrl, createShareMutation],
  );

  const availability: ShareAvailability = isAuthenticated
    ? "ready"
    : isLoading
      ? "connecting"
      : clerkSessionPresent()
        ? "backend-rejected"
        : "signed-out";

  return { createShare, canShare: isAuthenticated, availability };
}
