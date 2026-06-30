import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Download, Link2, Pencil } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api } from "../../../convex/_generated/api";
import { LargeButton } from "@/components/ui/large-button";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Toaster, toast } from "@/components/ui/sonner";

const horseLogo = "/Image-Horse-Logo.svg";

/** Public, read-only viewer for a `?v=<token>` share link. Renders the flattened
 *  snapshot with download / copy-link / open-editor actions. Works for anonymous
 *  visitors — `shares.get` and `shares.recordView` are public Convex functions. */
export function ShareViewer({ token }: { token: string }) {
  const share = useQuery(api.shares.get, { token });
  const recordView = useMutation(api.shares.recordView);
  const counted = useRef(false);

  // Count a view once per open (best-effort; ignore failures).
  useEffect(() => {
    if (share && !counted.current) {
      counted.current = true;
      recordView({ token }).catch(() => {});
    }
  }, [share, token, recordView]);

  const editorUrl = `${window.location.origin}${window.location.pathname}`;

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg-primary text-text-primary">
      <Toaster />
      <header className="flex w-full flex-col items-center pt-8 pb-4">
        <a href={editorUrl} className="flex flex-col items-center">
          <img
            src={horseLogo}
            alt="Image Horse"
            className="w-20 h-20 mb-2 drop-shadow-lg"
          />
          <h1 className="text-lg font-bold tracking-wide">Image Horse</h1>
        </a>
        <p className="text-xs text-text-muted mt-1">Shared image</p>
      </header>

      <main className="flex w-full max-w-3xl flex-1 flex-col items-center px-4 pb-10">
        {share === undefined && (
          <div className="flex w-full flex-col items-center gap-4" aria-label="Loading shared image">
            <Skeleton className="h-[60vh] w-full rounded-xl" />
            <SkeletonText aria-hidden="true" noOfLines={1} className="max-w-[16rem] items-center" lineClassName="h-3" />
          </div>
        )}

        {share === null && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-semibold">This link is no longer available.</p>
            <p className="text-xs text-text-muted">
              The share may have been revoked, or the link is incorrect.
            </p>
            <a href={editorUrl}>
              <LargeButton>
                <Pencil className="h-4 w-4" />
                Open the editor
              </LargeButton>
            </a>
          </div>
        )}

        {share && (
          <ShareReady share={share} editorUrl={editorUrl} />
        )}
      </main>
    </div>
  );
}

interface ShareData {
  imageUrl: string;
  canvasW: number;
  canvasH: number;
  title: string | null;
  views: number;
  createdAt: number;
}

function ShareReady({ share, editorUrl }: { share: ShareData; editorUrl: string }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      // Fetch → blob so the `download` attribute works across the storage origin.
      const resp = await fetch(share.imageUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stem = (share.title ?? "image").replace(/\.[^.]+$/, "");
      a.download = `${stem}-shared.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fall back to opening the raw image if the fetch is blocked.
      window.open(share.imageUrl, "_blank", "noopener");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    } catch {
      toast.info(window.location.href);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="w-full overflow-hidden rounded-xl border border-border bg-bg-secondary shadow-2xl">
        <img
          src={share.imageUrl}
          alt={share.title ?? "Shared image"}
          className="mx-auto block max-h-[70vh] w-auto max-w-full"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-text-muted">
        {share.title && <span className="font-medium text-text-primary">{share.title}</span>}
        <span>{share.canvasW}×{share.canvasH}</span>
        <span>·</span>
        <span>{share.views} {share.views === 1 ? "view" : "views"}</span>
        <span>·</span>
        <span>{new Date(share.createdAt).toLocaleDateString()}</span>
      </div>

      <div className="flex w-full max-w-md flex-wrap gap-2">
        <LargeButton className="flex-1" onClick={handleDownload} disabled={downloading}>
          {downloading ? (
            <Spinner size={16} />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download
        </LargeButton>
        <LargeButton className="flex-1" onClick={handleCopyLink}>
          <Link2 className="h-4 w-4" />
          Copy link
        </LargeButton>
        <a href={editorUrl} className="flex-1">
          <LargeButton className="w-full">
            <Pencil className="h-4 w-4" />
            Open the editor
          </LargeButton>
        </a>
      </div>
    </div>
  );
}
