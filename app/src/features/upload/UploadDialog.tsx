import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FolderOpen, X } from "lucide-react";
import { fadeIn, quickSpring } from "@/lib/animations";

interface Props {
  open: boolean;
  onClose: () => void;
  onFiles: (files: File[]) => void;
}

export function UploadDialog({ open, onClose, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length) {
      onFiles(files);
      onClose();
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length) {
      onFiles(files);
      onClose();
    }
    e.target.value = "";
  };

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
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary font-mono">
                <Upload className="h-5 w-5 text-accent" />
                Open Images
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
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
                className={`
                  border-2 border-dashed rounded-xl p-12 text-center transition-all
                  ${
                    dragging
                      ? "border-accent bg-accent-dim"
                      : "border-border bg-bg-tertiary"
                  }
                `}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center">
                    <Upload className="h-8 w-8 text-text-muted" />
                  </div>

                  <button
                    onClick={() => inputRef.current?.click()}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold bg-accent text-primary hover:brightness-110 transition-all"
                  >
                    <FolderOpen className="h-5 w-5" />
                    Browse Files
                  </button>

                  <p className="text-sm text-text-muted">
                    or drag and drop images here
                  </p>
                  <p className="text-xs text-text-muted opacity-50">
                    Supports PNG, JPG, GIF, WebP, AVIF
                  </p>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  hidden
                  onChange={handleFileInput}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
