import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FolderOpen, Clipboard, X, ExternalLink } from "lucide-react";
import { fadeIn, quickSpring } from "@/lib/animations";

interface Props {
  open: boolean;
  onClose: () => void;
  onFiles: (files: File[]) => void;
}

export function UploadDialog({ open, onClose, onFiles }: Props) {
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
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                <Upload className="h-5 w-5 text-white" />
                Upload Images
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drop zone */}
            <div
              className="px-6 pb-6"
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
            >
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
                  dragging
                    ? "border-accent bg-accent-dim"
                    : "border-border bg-bg-tertiary"
                }`}
              >
                <div className="flex flex-col items-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center">
                    <Upload className="h-8 w-8 text-text-muted" />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 flex-wrap justify-center">
                    <button
                      onClick={() => inputRef.current?.click()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold bg-accent text-text-primary hover:brightness-110 transition-all"
                    >
                      <FolderOpen className="h-4 w-4" /> Browse Files
                    </button>
                    <button
                      onClick={handlePasteClick}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-border-active transition-all"
                    >
                      <Clipboard className="h-4 w-4" /> Paste Image
                    </button>
                  </div>

                  {/* Drag & drop hint */}
                  <p className="text-base text-text-secondary font-medium">
                    or drag and drop images here
                  </p>

                  {/* Ctrl+V hint */}
                  <p className="text-sm text-text-secondary">
                    <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-xs font-mono">
                      Ctrl+V
                    </kbd>{" "}
                    to paste from clipboard
                  </p>

                  {/* Formats */}
                  <p className="text-sm text-text-muted">
                    Supports PNG, JPG, GIF, WebP, AVIF
                  </p>

                  {/* Squoosh attribution */}
                  <a
                    href="https://squoosh.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors mt-1"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Special thanks to squoosh.app — this app is loosely based on
                    that image compression tool.
                  </a>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    processFiles(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
