// Compact "New image" modal used MID-SESSION (Alt+N, or after Delete All). On
// cold start the same actions render full-page via FirstRunScreen instead — both
// share <NewActions/>. This wrapper owns the modal chrome: backdrop, logo/title
// header, sign-in, close button, and the shake when close is blocked.
//
// On `ui/dialog` since Night 5 (09-26-2026). It was hand-built on framer-motion,
// which cost it every piece of modal behaviour the primitive gives for free:
//   - no dialog role and no aria-modal, so a screen reader did not know it
//     was a dialog at all;
//   - no focus trap, so Tab walked the page behind the backdrop;
//   - Escape came from a WINDOW keydown listener, which fired on every Escape
//     anywhere regardless of what was on top;
//   - the ✕ had no accessible name;
//   - the title was an <h1>, not the dialog's name.
// Escape, the backdrop and the ✕ all reach `onOpenChange(false)` now, and all
// three go through `handleTryClose`, so the blocked-close shake (canClose=false,
// e.g. right after Delete All) behaves exactly as before.
import { useCallback, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewActions } from "@/features/upload/NewActions";

const horseLogo = "/Image-Horse-Logo.svg";

interface Props {
  open: boolean;
  onClose: () => void;
  onFiles: (files: File[]) => void;
  canClose?: boolean;
}

export function UploadDialog({
  open,
  onClose,
  onFiles,
  canClose = true,
}: Props) {
  const controls = useAnimation();
  // The New Canvas ("New Document") panel hides the logo/title header for an
  // uncluttered setup view. NewActions reports its state up to us.
  const [blankMode, setBlankMode] = useState(false);

  const triggerShake = useCallback(async () => {
    await controls.start({
      x: [0, -14, 14, -10, 10, -6, 6, -3, 3, 0],
      transition: { duration: 0.55, ease: "easeInOut" },
    });
    controls.set({ x: 0 });
  }, [controls]);

  const handleTryClose = useCallback(() => {
    if (!canClose) triggerShake();
    else onClose();
  }, [canClose, onClose, triggerShake]);

  return (
    <Dialog
      open={open}
      // Every way out — Escape, the backdrop, the ✕ — arrives here. `open` is
      // controlled, so when closing is blocked and onClose is never called the
      // dialog simply stays open and shakes.
      onOpenChange={(next) => {
        if (!next) handleTryClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        // The rounder corner is this dialog's own; keeping it holds the visual
        // change of the port to the semantics, which is the point of it. The
        // 1rem gutter keeps the panel off the screen edge on a phone.
        className="w-[calc(100%-2rem)] max-w-lg rounded-2xl"
      >
        <motion.div animate={controls}>
          {/* Logo + Title — top center. Hidden in New Canvas mode so the
              "New Document" setup gets the full panel. The title is ALWAYS in
              the tree: it is the dialog's accessible name, and a dialog with
              no name is announced as just "dialog". */}
          {blankMode ? (
            <>
              <div className="pt-6" />
              <DialogTitle className="sr-only">New image</DialogTitle>
            </>
          ) : (
            <div className="flex flex-col items-center pt-6 pb-2">
              <img
                src={horseLogo}
                alt=""
                className="w-30 h-30 mb-2 drop-shadow-lg"
              />
              <DialogTitle className="text-lg font-bold text-text-primary tracking-wide">
                Image Horse
              </DialogTitle>
            </div>
          )}

          {/* Close — the same named button the shared DialogHeader renders. */}
          <DialogClose asChild>
            <Button size="tiny" className="absolute top-4 right-4" aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>

          <NewActions
            onFiles={onFiles}
            onFilesAdded={onClose}
            onInvalidFiles={triggerShake}
            autoFocusFirst
            onBlankModeChange={setBlankMode}
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
