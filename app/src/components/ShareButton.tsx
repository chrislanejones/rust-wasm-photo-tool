import { useState } from "react";
import { Share2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ToolButton } from "@/components/ui/tool-button";
import { toast } from "@/components/ui/sonner";
import { useShare } from "@/hooks/useShare";

interface Props {
  /** Produce the flattened canvas snapshot to share (PNG). */
  exportPng: () => Promise<Blob | null>;
  canvasW: number;
  canvasH: number;
  /** Human label stored with the share (e.g. the photo filename). */
  fileName?: string;
  disabled?: boolean;
  /** Called after a link is created (e.g. to close the export dialog). */
  onShared?: () => void;
}

/** "Create share link" action for the export dialog. Uploads a read-only PNG
 *  snapshot to Convex, mints a public URL, and copies it to the clipboard.
 *  Self-contained so AppShell only has to mount it. */
export function ShareButton({
  exportPng,
  canvasW,
  canvasH,
  fileName,
  disabled,
  onShared,
}: Props) {
  const { createShare, canShare, availability } = useShare();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    if (!canShare) {
      // Say which of the three it actually is. "Sign in to create share links"
      // was shown for all of them, including to users who were signed in —
      // sending them to look for a sign-in button they had already used.
      if (availability === "connecting") {
        toast.info("Still connecting to your account — try that again in a second.");
      } else if (availability === "backend-rejected") {
        toast.error("You're signed in, but the share service didn't accept the session.", {
          description:
            "This is a configuration mismatch, not something you did. Signing out and back in won't help.",
        });
      } else {
        toast.info("Sign in to create share links.");
      }
      return;
    }
    setBusy(true);
    try {
      const blob = await exportPng();
      if (!blob) throw new Error("Nothing to share yet.");
      const { url } = await createShare({
        blob,
        canvasW,
        canvasH,
        title: fileName,
      });
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied to clipboard", { description: url });
      } catch {
        // Clipboard blocked (permissions / insecure context) — surface the URL
        // so the user can still copy it by hand.
        toast.success("Share link created", { description: url });
      }
      onShared?.();
    } catch (err) {
      toast.error(
        `Couldn't create share link: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolButton
      stacked
      className="flex-1"
      onClick={handleClick}
      disabled={disabled || busy}
      title={
        canShare
          ? "Create a public share link"
          : availability === "connecting"
            ? "Connecting to your account…"
            : availability === "backend-rejected"
              ? "Signed in, but the share service didn't accept the session"
              : "Sign in to share"
      }
    >
      {busy ? <Spinner size={24} /> : <Share2 />}
      <span>{busy ? "Creating…" : "Share link"}</span>
    </ToolButton>
  );
}
