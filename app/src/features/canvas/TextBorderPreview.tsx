// The open textarea's box border preview (ADR-109), drawn over the fill
// preview CanvasArea draws behind the text. Its own file because CanvasArea
// sits on a max-lines ratchet (eslint.config.mjs). It mirrors
// `build_annotation_tile` (src/layer.rs): the border is a band INSIDE the
// box's edge, around the rect and a bubble's tail alike.

interface TextBorderPreviewProps {
  /** Where the wrapper sits and how it turns: the fill wrapper's own box. */
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  transformOrigin: string;
  /** The box rect inside the wrapper, and its corner radius. */
  rect: { x: number; y: number; w: number; h: number; radius: number };
  /** The bubble's tail, as `svgPoints`; absent for a plain rect. */
  tail?: string;
  /** Screen px. */
  borderWidth: number;
  color: string;
  /** 0-1. */
  opacity: number;
}

/** The box border over the fill preview. Its own layer, not inside the fill's
 *  wrapper: that one carries the FILL opacity, and a stamp's fill is
 *  transparent while its border is not. The engine draws the band INSIDE the
 *  box edge (`box_border_ring`), so this erodes the same rect ∪ tail by the
 *  width and keeps what was eroded away. The erode kernel is square where the
 *  engine's distance is round, so a rounded corner's inner edge can differ by
 *  a pixel; the outside edge cannot. */
export function TextBorderPreview(p: TextBorderPreviewProps) {
  const { rect } = p;
  return (
    <svg
      data-text-overlay
      data-testid="text-border-preview"
      width={p.width}
      height={p.height}
      style={{
        position: "absolute",
        left: p.left,
        top: p.top,
        pointerEvents: "none",
        zIndex: 49,
        overflow: "visible",
        opacity: p.opacity,
        transform: `rotate(${p.rotation}deg)`,
        transformOrigin: p.transformOrigin,
      }}
    >
      <defs>
        <filter id="text-border-inside" x="0" y="0" width="1" height="1">
          <feMorphology in="SourceAlpha" operator="erode" radius={p.borderWidth} result="inner" />
          <feComposite in="SourceGraphic" in2="inner" operator="out" />
        </filter>
      </defs>
      <g filter="url(#text-border-inside)">
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          rx={Math.min(rect.radius, rect.w / 2, rect.h / 2)}
          fill={p.color}
        />
        {p.tail && <polygon points={p.tail} fill={p.color} />}
      </g>
    </svg>
  );
}
