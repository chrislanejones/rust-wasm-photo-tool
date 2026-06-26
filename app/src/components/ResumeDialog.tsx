// Returning-session prompt for anonymous (non-login) users. Their gallery is
// saved locally (IndexedDB), so after a tab close (Ctrl+W) / reload we offer to
// pick up where they left off — or start fresh. Signed-in users skip this and
// control auto-reopen from Settings → General instead.
//
// Uses the shared Dialog primitives so it matches the other modals: title in the
// header (with a close X), content in the body, the two actions in the footer.
import { useCallback, useEffect, useMemo } from "react";
import { motion, useAnimation } from "framer-motion";
import { Upload } from "lucide-react";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  photos: PhotoEntry[];
  onResume: () => void;
  onStartFresh: () => void;
  /** Optional override for the dialog box (e.g. the Dev Tests preview). */
  className?: string;
}

export function ResumeDialog({
  open,
  photos,
  onResume,
  onStartFresh,
  className,
}: Props) {
  // Object URLs for a few thumbnail previews; revoked on unmount / change.
  const thumbUrls = useMemo(
    () => photos.slice(0, 5).map((p) => URL.createObjectURL(p.thumbBlob)),
    [photos],
  );
  useEffect(
    () => () => thumbUrls.forEach((u) => URL.revokeObjectURL(u)),
    [thumbUrls],
  );

  const n = photos.length;
  const more = n - thumbUrls.length;

  // The header X / Esc / click-outside don't dismiss — there's no neutral
  // "close" here (you must pick Resume or Start fresh), so a close attempt just
  // shakes the box to nudge a choice, the same way the upload dialog does.
  const controls = useAnimation();
  const triggerShake = useCallback(async () => {
    await controls.start({
      x: [0, -14, 14, -10, 10, -6, 6, -3, 3, 0],
      transition: { duration: 0.55, ease: "easeInOut" },
    });
    controls.set({ x: 0 });
  }, [controls]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && triggerShake()}>
      <DialogContent className={cn("max-w-sm", className)}>
        <motion.div animate={controls}>
        <DialogHeader>
          <DialogTitle>Welcome back</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <p className="text-sm text-text-secondary">
            Your last session is still here — {n} {n === 1 ? "image" : "images"},
            saved on this device.
          </p>

          {thumbUrls.length > 0 && (
            <div className="flex items-center gap-2">
              {thumbUrls.map((u, i) => (
                <img
                  key={i}
                  src={u}
                  alt=""
                  className="h-12 w-12 rounded-lg border border-border object-cover"
                />
              ))}
              {more > 0 && (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-bg-elevated text-lg font-semibold text-text-secondary">
                  +{more}
                </div>
              )}
            </div>
          )}

          <p className="text-2xs text-text-muted">
            “Start fresh” clears this saved session and opens a new upload.
          </p>
        </DialogBody>

        <DialogFooter>
          <button
            type="button"
            onClick={onResume}
            className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:brightness-110"
          >
            Resume editing
          </button>
          <button
            type="button"
            onClick={onStartFresh}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated/70"
          >
            <Upload className="h-3.5 w-3.5" />
            Start fresh
          </button>
        </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
