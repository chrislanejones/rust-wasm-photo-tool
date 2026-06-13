import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Upload, FolderOpen, Clipboard, X, Images, Loader2, LogIn, ExternalLink } from "lucide-react";
import { fadeIn, quickSpring } from "@/lib/animations";
import { LargeButton } from "@/components/ui/large-button";
import { TinyButton } from "@/components/ui/tiny-button";
import { fetchTestImages, TEST_IMAGE_COUNT } from "@/lib/testImages";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  const controls = useAnimation();

  const triggerShake = useCallback(async () => {
    await controls.start({
      x: [0, -14, 14, -10, 10, -6, 6, -3, 3, 0],
      transition: { duration: 0.55, ease: "easeInOut" },
    });
    controls.set({ x: 0 });
  }, [controls]);

  const handleTryClose = useCallback(() => {
    if (!canClose) {
      triggerShake();
    } else {
      onClose();
    }
  }, [canClose, onClose, triggerShake]);

  const processFiles = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length) {
        onFiles(images);
        onClose();
      }
    },
    [onFiles, onClose],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  // Pull a fixed set of large, royalty-free Unsplash photos from UploadThing
  // (public URLs) and run them through the normal upload pipeline.
  const handleTestImages = useCallback(async () => {
    if (loadingTest) return;
    setLoadingTest(true);
    try {
      const files = await fetchTestImages();
      if (files.length) processFiles(files);
      else triggerShake();
    } catch (err) {
      console.error("Test Free Images failed:", err);
      triggerShake();
    } finally {
      setLoadingTest(false);
    }
  }, [loadingTest, processFiles, triggerShake]);

  const handlePasteClick = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            files.push(
              new File([blob], `pasted-image.${type.split("/")[1] ?? "png"}`, {
                type,
              }),
            );
          }
        }
      }
      if (files.length) processFiles(files);
    } catch (err) {
      console.warn("Clipboard read failed — use Ctrl+V:", err);
    }
  }, [processFiles]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = Array.from(items)
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length) {
        e.preventDefault();
        processFiles(files);
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [open, processFiles]);

  // Keyboard support: focus the first action when the dialog opens, and let
  // Escape close it (shake when closing is blocked, same as the ✕ button).
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => firstButtonRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleTryClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, handleTryClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
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
            {/* Logo + Title - Top Center */}
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

            {/* Close button */}
            <TinyButton
              className="absolute top-4 right-4"
              onClick={handleTryClose}
            >
              <X className="h-4 w-4" />
            </TinyButton>

            {/* Loading bar */}
            {isLoading && (
              <div className="px-6 pt-2">
                <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent to-accent/60 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{
                      width: `${Math.min(loadProgress, 100)}%`,
                    }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            <div className="p-6">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
                  dragging
                    ? "border-accent bg-accent/10"
                    : "border-border bg-bg-elevated/30"
                }`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-bg-elevated flex items-center justify-center">
                    <Upload className="h-7 w-7 text-text-muted" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full">
                    <LargeButton
                      ref={firstButtonRef}
                      onClick={() => inputRef.current?.click()}
                      className="w-full"
                    >
                      <FolderOpen className="h-4 w-4" />
                      Browse Files
                    </LargeButton>
                    <LargeButton onClick={handlePasteClick} className="w-full">
                      <Clipboard className="h-4 w-4" />
                      Paste (Ctrl+V)
                    </LargeButton>
                    <LargeButton
                      onClick={handleTestImages}
                      disabled={loadingTest}
                      className="w-full"
                    >
                      {loadingTest ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Images className="h-4 w-4" />
                      )}
                      {loadingTest ? `Loading ${TEST_IMAGE_COUNT}…` : "Test Images"}
                    </LargeButton>
                    <LargeButton
                      disabled
                      title="View images from your last session (coming soon)"
                      className="w-full"
                    >
                      <LogIn className="h-4 w-4" />
                      Log In
                    </LargeButton>
                  </div>

                  <p className="text-xs text-text-muted">
                    or drag and drop images here
                  </p>
                  <p className="text-[10px] text-text-muted opacity-60">
                    Supports PNG, JPG, GIF, WebP, AVIF
                  </p>
                </div>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  processFiles(Array.from(e.target.files));
                }
              }}
            />

            <div className="px-6 pb-4">
              {/* LargeButton renders a <button>, so open the marketing site
                  via window.open instead of an anchor href. */}
              <LargeButton
                onClick={() =>
                  window.open(
                    "https://image-horse.vercel.app/",
                    "_blank",
                    "noopener",
                  )
                }
                className="w-full"
              >
                image-horse.vercel.app
                <ExternalLink className="h-4 w-4" />
              </LargeButton>
            </div>
          </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
