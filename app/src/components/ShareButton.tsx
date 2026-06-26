import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";
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
  const { createShare, canShare } = useShare();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    if (!canShare) {
      toast.info("Sign in to create share links.");
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
      title={canShare ? "Create a public share link" : "Sign in to share"}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Share2 />}
      <span>{busy ? "Creating…" : "Share link"}</span>
    </ToolButton>
  );
}
