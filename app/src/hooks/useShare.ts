import { useCallback } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cloudPhotosAllowed } from "@/hooks/useEditPersistence";
import { useUIStore } from "@/stores/useUIStore";
import type { Id } from "../../../convex/_generated/dataModel";

/** Build the public share URL for a token, anchored to wherever the app is
 *  served (origin + path, so it works on localhost and any deploy host).
 *  Exported for Settings › Shared's Copy link — one spelling of the URL. */
export function shareUrlFor(token: string): string {
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
  | "online-off" // signed in, but "Everything in your browser" is on — nothing may leave the tab
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
 *  Requires a signed-in user (the upload URL is auth-gated) AND the online
 *  switch on: a share link is the most deliberate upload in the app, and
 *  Settings › Security promises that with the switch off nothing leaves the
 *  tab. Until QC F2 (09-24-2026) this path checked sign-in alone — the one
 *  photo upload #149's `cloudPhotosAllowed` never reached. */
export function useShare() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const onlineFeatures = useUIStore((s) => s.onlineFeaturesEnabled);
  const allowed = cloudPhotosAllowed(isAuthenticated, onlineFeatures);
  const generateUploadUrl = useMutation(api.shares.generateUploadUrl);
  const createShareMutation = useMutation(api.shares.create);

  const createShare = useCallback(
    async (input: CreateShareInput): Promise<{ url: string; token: string }> => {
      // Read at call time, not from the render: the switch may have changed
      // since, and the refusal must come BEFORE an upload URL is requested.
      if (!useUIStore.getState().onlineFeaturesEnabled) {
        throw new Error("Online features are off, so nothing leaves this tab.");
      }
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
    ? onlineFeatures
      ? "ready"
      : "online-off"
    : isLoading
      ? "connecting"
      : clerkSessionPresent()
        ? "backend-rejected"
        : "signed-out";

  return { createShare, canShare: allowed, availability };
}
