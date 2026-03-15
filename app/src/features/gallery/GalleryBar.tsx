import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { slideFromBottom } from "@/lib/animations";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface PhotoEntry {
  id: string;
  url: string;
  name: string;
  file: File;
}

interface Props {
  photos: PhotoEntry[];
  activeId: string | null;
  onSelect: (entry: PhotoEntry) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  showTools: boolean;
  showHistory: boolean;
}

export function GalleryBar({
  photos,
  activeId,
  onSelect,
  onRemove,
  onClose,
  showTools,
  showHistory,
}: Props) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeId || !stripRef.current) return;
    const el = stripRef.current.querySelector<HTMLElement>(
      `[data-id="${activeId}"]`,
    );
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeId, photos.length]);

  if (photos.length === 0) return null;

  return (
    <motion.div
      variants={slideFromBottom}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed left-0 right-0 bottom-[48px] z-40"
    >
      <motion.div
        animate={{
          marginLeft: showTools ? 312 : 12,
          marginRight: showHistory ? 232 : 12,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{ position: "relative" }}
        className="bg-[var(--bg-secondary)]/90 backdrop-blur-sm rounded-xl shadow-2xl border border-[var(--border)]"
      >
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Header */}
        <div className="flex items-center gap-2 pr-2 border-r border-[var(--border)]">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono">
            Gallery
          </span>
          <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-full">
            {photos.length}
          </span>
        </div>

        {/* Thumbnails */}
        <div ref={stripRef} className="flex gap-1.5 overflow-x-auto flex-1 py-1 scrollbar-thin">
          {photos.map((entry) => (
            <div
              key={entry.id}
              data-id={entry.id}
              className={`photo-thumb ${entry.id === activeId ? "active" : ""}`}
              onClick={() => onSelect(entry)}
              title={entry.name}
            >
              <img src={entry.url} alt={entry.name} draggable={false} />
              <button
                className="photo-thumb-remove"
                title="Remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(entry.id);
                }}
              >
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
                </svg>
              </button>
              <span className="photo-thumb-label">{entry.name}</span>
            </div>
          ))}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      </motion.div>
    </motion.div>
  );
}
