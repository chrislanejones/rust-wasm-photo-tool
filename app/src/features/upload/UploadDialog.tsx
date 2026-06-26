// Compact "New image" modal used MID-SESSION (Alt+N, or after Delete All). On
// cold start the same actions render full-page via FirstRunScreen instead — both
// share <NewActions/>. This wrapper owns the modal chrome: backdrop, logo/title
// header, sign-in, close button, and the shake when close is blocked.
import { useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { X } from "lucide-react";
import { fadeIn, quickSpring } from "@/lib/animations";
import { TinyButton } from "@/components/ui/tiny-button";
import { UserMenu } from "@/components/UserMenu";
import { NewActions } from "@/features/upload/NewActions";

const horseLogo = "/Image-Horse-Logo.svg";

interface Props {
  open: boolean;
  onClose: () => void;
  onFiles: (files: File[]) => void;
  isLoading?: boolean;
  loadProgress?: number;
  canClose?: boolean;
}

export function UploadDialog({
  open,
  onClose,
  onFiles,
  isLoading = false,
  loadProgress = 0,
  canClose = true,
}: Props) {
  const controls = useAnimation();

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

  // Escape closes (shake when closing is blocked, same as the ✕ button).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleTryClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleTryClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleTryClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={quickSpring}
            className="relative w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              animate={controls}
              className="bg-bg-secondary rounded-2xl border border-border shadow-2xl overflow-hidden"
            >
              {/* Logo + Title — top center */}
              <div className="flex flex-col items-center pt-6 pb-2">
                <img
                  src={horseLogo}
                  alt="Image Horse"
                  className="w-30 h-30 mb-2 drop-shadow-lg"
                />
                <h1 className="text-lg font-bold text-text-primary tracking-wide">
                  Image Horse
                </h1>
              </div>

              {/* Sign-in — top-left, mirroring the close button's spot */}
              <div className="absolute top-4 left-4">
                <UserMenu />
              </div>

              {/* Close */}
              <TinyButton className="absolute top-4 right-4" onClick={handleTryClose}>
                <X className="h-4 w-4" />
              </TinyButton>

              <NewActions
                onFiles={onFiles}
                onFilesAdded={onClose}
                onInvalidFiles={triggerShake}
                isLoading={isLoading}
                loadProgress={loadProgress}
                autoFocusFirst
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
