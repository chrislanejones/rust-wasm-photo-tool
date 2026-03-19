import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FolderOpen, Clipboard, X, Heart } from "lucide-react";
import { fadeIn, quickSpring } from "@/lib/animations";

interface Props {
  open: boolean;
  onClose: () => void;
  onFiles: (files: File[]) => void;
  isLoading?: boolean;
  loadProgress?: number;
}

export function UploadDialog({
  open,
  onClose,
  onFiles,
  isLoading = false,
  loadProgress = 0,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={quickSpring}
            className="relative w-full max-w-lg mx-4 bg-bg-secondary rounded-2xl border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* FIX #2: Loading progress bar */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-0 left-0 right-0 z-10 h-1 bg-bg-elevated overflow-hidden rounded-t-2xl"
                >
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent to-[hsl(var(--accent)/0.7)]"
                    initial={{ width: "0%" }}
                    animate={{ width: `${Math.min(loadProgress, 100)}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-2">
              <div>
                {/* FIX #4: Rebrand to Image Horse */}
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  🐴 Image Horse
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  Upload images to start editing
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drop zone */}
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

                  <div className="flex gap-3 flex-wrap justify-center">
                    <button
                      onClick={() => inputRef.current?.click()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm bg-accent text-text-primary hover:brightness-110 transition-all"
                    >
                      <FolderOpen className="h-4 w-4" />
                      Browse Files
                    </button>
                    <button
                      onClick={handlePasteClick}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-border-active transition-all"
                    >
                      <Clipboard className="h-4 w-4" />
                      Paste (Ctrl+V)
                    </button>
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

            {/* FIX #3: Special Thanks styling */}
            <div className="px-6 pb-5">
              <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-bg-elevated/50 border border-border/50">
                <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400/30" />
                <span className="text-[11px] text-text-muted font-mono">
                  Powered by{" "}
                  <span className="text-accent font-semibold">Rust/WASM</span>
                  {" · "}All processing happens in your browser
                </span>
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
                  e.target.value = "";
                }
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
