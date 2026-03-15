import { motion } from "framer-motion";
import { slideFromTop } from "@/lib/animations";
import {
  Upload,
  Image,
  Wrench,
  ZoomIn,
  ZoomOut,
  History,
} from "lucide-react";

interface TopBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  showUpload: boolean;
  showTools: boolean;
  showGallery: boolean;
  showHistory: boolean;
  onToggleUpload: () => void;
  onToggleTools: () => void;
  onToggleGallery: () => void;
  onToggleHistory: () => void;
  imageCount: number;
}

export function TopBar({
  zoom,
  onZoomIn,
  onZoomOut,
  showUpload,
  showTools,
  showGallery,
  showHistory,
  onToggleUpload,
  onToggleTools,
  onToggleGallery,
  onToggleHistory,
  imageCount,
}: TopBarProps) {
  const toggleButtons = [
    { key: "U", icon: Upload,  label: "Upload",  state: showUpload,  toggle: onToggleUpload },
    { key: "S", icon: Wrench,  label: "Tools",   state: showTools,   toggle: onToggleTools },
    { key: "I", icon: Image,   label: "Gallery", state: showGallery, toggle: onToggleGallery },
    { key: "H", icon: History, label: "History", state: showHistory, toggle: onToggleHistory },
  ];

  return (
    <motion.div
      variants={slideFromTop}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed top-3 left-0 right-0 z-30 pointer-events-none"
    >
      <motion.div
        animate={{
          paddingLeft: showTools ? 312 : 12,
          paddingRight: showHistory ? 232 : 12,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="pointer-events-auto">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 bg-[var(--bg-secondary)]/90 backdrop-blur-sm rounded-xl border border-[var(--border)]">
            {/* Left — Zoom */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onZoomOut}
                disabled={zoom <= 0.25}
                className="p-1.5 rounded-md hover:bg-[var(--bg-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[var(--text-secondary)]"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold font-mono w-12 text-center tabular-nums text-[var(--text-primary)]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={onZoomIn}
                disabled={zoom >= 4}
                className="p-1.5 rounded-md hover:bg-[var(--bg-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[var(--text-secondary)]"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            {/* Center — Upload / Tools / Gallery / History */}
            <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-tertiary)] justify-self-center">
              {toggleButtons.map(({ key, icon: Icon, label, state, toggle }) => (
                <button
                  key={key}
                  onClick={toggle}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold font-mono transition-all ${
                    state
                      ? "bg-[var(--accent)] text-white shadow-md"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Right — Image count */}
            <div className="flex items-center justify-self-end">
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {imageCount} image{imageCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
