// Returning-session prompt for anonymous (non-login) users. Their gallery is
// saved locally (IndexedDB), so after a tab close (Ctrl+W) / reload we offer to
// pick up where they left off — or start fresh. Signed-in users skip this and
// control auto-reopen from Settings → General instead.
import { useEffect, useMemo } from "react";
import { KeyRound, Upload } from "lucide-react";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

interface Props {
  open: boolean;
  photos: PhotoEntry[];
  onResume: () => void;
  onStartFresh: () => void;
}

export function ResumeDialog({ open, photos, onResume, onStartFresh }: Props) {
  // Object URLs for a few thumbnail previews; revoked on unmount / change.
  const thumbUrls = useMemo(
    () => photos.slice(0, 4).map((p) => URL.createObjectURL(p.thumbBlob)),
    [photos],
  );
  useEffect(
    () => () => thumbUrls.forEach((u) => URL.revokeObjectURL(u)),
    [thumbUrls],
  );

  if (!open) return null;
  const n = photos.length;
  const more = n - thumbUrls.length;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-lg font-semibold text-text-primary">Welcome back</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Your last session is still here — {n} {n === 1 ? "image" : "images"},
          saved on this device.
        </p>

        {thumbUrls.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            {thumbUrls.map((u, i) => (
              <img
                key={i}
                src={u}
                alt=""
                className="h-12 w-12 rounded-lg border border-border object-cover"
              />
            ))}
            {more > 0 && (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-bg-elevated text-2xs text-text-muted">
                +{more}
              </div>
            )}
          </div>
        )}

        {/* Local + private — non-interactive status (not a button). */}
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-2xs text-text-muted">
          <KeyRound className="h-3 w-3" />
          Private — saved on this device only
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:brightness-110"
          >
            Resume editing
          </button>
          <button
            type="button"
            onClick={onStartFresh}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated/70"
          >
            <Upload className="h-3.5 w-3.5" />
            Start fresh
          </button>
        </div>
        <p className="mt-2 text-center text-2xs text-text-muted">
          “Start fresh” clears this saved session and opens a new upload.
        </p>
      </div>
    </div>
  );
}
