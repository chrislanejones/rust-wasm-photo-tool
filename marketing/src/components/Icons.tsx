// The site's icons, in one place.
//
// Inlined as components rather than pulled from an icon package: there are a
// couple of dozen, they never change, and a dependency to draw a few paths is a
// dependency to keep patched forever.
//
// The eleven below — brush, stamp, text, shapes, emoji, eraser, wand, crop,
// resize, undo, export — are the editor's own tool glyphs, traced from the
// `lucide-react` versions the app draws so the tile set on the home page reads
// as the same software, not an approximation of it. They are the only icons
// here that exist to depict the product rather than to label this site.
//
// Traced, not imported: `lucide-react` is already a dependency here (the
// features table uses it), so pulling these five would have cost nothing new.
// They are hand-written anyway to sit beside the six that came first, which
// predate that dependency — one file, one way of drawing, rather than a set
// where half the glyphs take `size` and half take lucide's props.

interface IconProps {
  size?: number;
  className?: string;
}

/** Line icons share these — stroke-based, currentColor, no fill. */
const line = (size: number) => ({
  viewBox: "0 0 24 24",
  width: size,
  height: size,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function GitHubIcon({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}

export function CodebergIcon({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 1.5A10.5 10.5 0 0 0 1.5 12c0 2.45.84 4.71 2.25 6.5L11.9 5.55a.12.12 0 0 1 .2 0l8.15 12.95A10.46 10.46 0 0 0 22.5 12 10.5 10.5 0 0 0 12 1.5Z" />
      <path d="M12.43 8.6l6.95 11.04a10.48 10.48 0 0 1-1.71 1.27L12 9.3l.43-.7Z" opacity=".55" />
    </svg>
  );
}

export function SearchIcon({ size = 18 }: IconProps) {
  return (
    <svg {...line(size)}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function DownloadIcon({ size = 18 }: IconProps) {
  return (
    <svg {...line(size)}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

/** "everything" — a plain list */
export function ListIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M3 5h.01" />
      <path d="M3 12h.01" />
      <path d="M3 19h.01" />
      <path d="M8 5h13" />
      <path d="M8 12h13" />
      <path d="M8 19h13" />
    </svg>
  );
}

/** "your machine" — the copy's claim is literally "runs on your own CPU" */
export function CpuIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M12 20v2" />
      <path d="M12 2v2" />
      <path d="M17 20v2" />
      <path d="M17 2v2" />
      <path d="M2 12h2" />
      <path d="M2 17h2" />
      <path d="M2 7h2" />
      <path d="M20 12h2" />
      <path d="M20 17h2" />
      <path d="M20 7h2" />
      <path d="M7 20v2" />
      <path d="M7 2v2" />
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </svg>
  );
}

export function ServerIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

/** "all tiers" — stacked layers */
export function LayersIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
    </svg>
  );
}

/** "logged out" — user with an x */
export function UserXIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" x2="22" y1="8" y2="13" />
      <line x1="22" x2="17" y1="8" y2="13" />
    </svg>
  );
}

/** "logged in" — user with a check */
export function UserCheckIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="m16 11 2 2 4-4" />
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

/** "pro" — a crown */
export function CrownIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function BurgerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <g className="bar-lines">
        <line x1="3" y1="7" x2="21" y2="7" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="17" x2="21" y2="17" />
      </g>
      <g className="bar-x">
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="6" y1="18" x2="18" y2="6" />
      </g>
    </svg>
  );
}

export function BrushIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
    </svg>
  );
}

export function WandIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="m3 21 9-9" />
      <path d="M15 4V2" />
      <path d="M15 16v-2" />
      <path d="M8 9h2" />
      <path d="M20 9h2" />
      <path d="M17.8 11.8 19 13" />
      <path d="M15 9h.01" />
      <path d="M17.8 6.2 19 5" />
      <path d="m11 13 1.2-1.2" />
      <path d="M11 5l1.2 1.2" />
    </svg>
  );
}

export function CropIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  );
}

export function ResizeIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

export function UndoIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

export function ExportIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </svg>
  );
}

export function StampIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13" />
      <path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z" />
      <path d="M5 22h14" />
    </svg>
  );
}

export function TextIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M12 4v16" />
      <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
      <path d="M9 20h6" />
    </svg>
  );
}

export function ShapesIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <circle cx="17.5" cy="17.5" r="3.5" />
    </svg>
  );
}

/** The emoji tool. A drawn face, not an emoji character: a literal 🙂 would
 *  render in the reader's own emoji font at whatever weight and hue that font
 *  chooses, which is the one glyph on the tile that could not take the accent
 *  color when the tile is pressed. */
export function EmojiIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M15 10V9" />
      <path d="M9 10V9" />
      <path d="M16.472 15a6 6 0 0 1-8.943 0" />
    </svg>
  );
}

export function EraserIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...line(size)} className={className}>
      <path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21" />
      <path d="m5.082 11.09 8.828 8.828" />
    </svg>
  );
}
