import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * File-format glyphs for the Download dialog's Format picker — lucide's
 * `file-type-corner` with the "T" taken out of the open corner and the
 * format's name lettered in its place (JPEG, PNG, WEBP, AVIF, ORA, SVG, PSD).
 *
 * Drawn on lucide's 24px grid with its stroke settings, so they sit in a
 * `ToolButton` tile exactly like a lucide icon and size from the same
 * `[&_svg]` rule. Take `className`, plus `style` for a caller that needs a
 * size the tile's descendant `[&_svg]` rule would otherwise override.
 *
 * The lettering is real SVG `<text>`, squeezed to a fixed `textLength` so a
 * four-letter name and a three-letter one both fill the corner without the
 * font deciding the width. It is NOT aria-hidden: the tile's name is the
 * format's hint ("Lossless · transparency"), and the lettering is what puts
 * the format itself into that name for a screen reader.
 */
const FILE_OUTLINE =
  "M12 22h6a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v6";
const FILE_FOLD = "M14 2v5a1 1 0 0 0 1 1h5";

/** Exported for the Download dialog, whose plugin-format tiles need a glyph
 *  for a label nobody here knew in advance ("IHL"). Built-in formats get
 *  theirs below, at module scope, so each keeps one component identity. */
export function makeFileTypeIcon(label: string) {
  // 4 letters get 15 units, 3 get 12 — measured against the open corner
  // (x 1 → 16) so the longest name never touches the right-hand edge.
  const textLength = label.length >= 4 ? 15 : 12;
  function FileTypeIcon({
    className,
    style,
  }: {
    className?: string;
    style?: React.CSSProperties;
  }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("lucide", className)}
        style={style}
      >
        <path d={FILE_OUTLINE} />
        <path d={FILE_FOLD} />
        <text
          x="1"
          y="20"
          textLength={textLength}
          lengthAdjust="spacingAndGlyphs"
          fill="currentColor"
          stroke="none"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="7"
          fontWeight={800}
        >
          {label}
        </text>
      </svg>
    );
  }
  FileTypeIcon.displayName = `File${label}Icon`;
  return FileTypeIcon;
}

export const FileJpegIcon = makeFileTypeIcon("JPEG");
export const FilePngIcon = makeFileTypeIcon("PNG");
export const FileWebpIcon = makeFileTypeIcon("WEBP");
export const FileAvifIcon = makeFileTypeIcon("AVIF");
export const FileOraIcon = makeFileTypeIcon("ORA");
export const FileSvgIcon = makeFileTypeIcon("SVG");
export const FilePsdIcon = makeFileTypeIcon("PSD");
