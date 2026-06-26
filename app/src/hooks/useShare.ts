import { useCallback } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

/** Build the public share URL for a token, anchored to wherever the app is
 *  served (origin + path, so it works on localhost and any deploy host). */
export function shareUrlFor(token: string): string {
  return `${window.location.origin}${window.location.pathname}?v=${token}`;
}

export interface CreateShareInput {
  /** Flattened canvas snapshot (PNG). */
  blob: Blob;
  canvasW: number;
  canvasH: number;
  /** Optional human label (e.g. the photo's filename). */
  title?: string;
}

/** Create-side of share links: upload a flattened PNG snapshot to Convex
 *  storage, mint a token, and hand back a ready-to-copy public URL.
 *  Requires a signed-in user (the upload URL is auth-gated). */
export function useShare() {
  const { isAuthenticated } = useConvexAuth();
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
        storageId: storageId as any,
        canvasW: input.canvasW,
        canvasH: input.canvasH,
        title: input.title,
      });
      return { url: shareUrlFor(token), token };
    },
    [generateUploadUrl, createShareMutation],
  );

  return { createShare, canShare: isAuthenticated };
}
