import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FolderOpen, X } from "lucide-react";
import { fadeIn } from "@/lib/animations";

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
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg mx-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)] font-mono">
                <Upload className="h-5 w-5 text-[var(--accent)]" />
                Open Images
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
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
                  ${dragging
                    ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                    : "border-[var(--border)] bg-[var(--bg-tertiary)]"
                  }
                `}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
                    <Upload className="h-8 w-8 text-[var(--text-muted)]" />
                  </div>

                  <button
                    onClick={() => inputRef.current?.click()}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold bg-[var(--accent)] text-white hover:brightness-110 transition-all"
                  >
                    <FolderOpen className="h-5 w-5" />
                    Browse Files
                  </button>

                  <p className="text-sm text-[var(--text-muted)]">
                    or drag and drop images here
                  </p>
                  <p className="text-xs text-[var(--text-muted)] opacity-50">
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
