// The magnetic lasso's live wire, drawn over the canvas.
//
// Two polylines, both computed in Rust (`lasso_committed_path` / `lasso_path_to`)
// and handed here as flat [x0,y0,x1,y1,…] image-space pairs — this component
// does no geometry, it only projects. Same rule as SelectionOverlay: the engine
// owns pixels and paths, JS owns display.
//
// It rides the SAME `translate(pan) scale(zoom)` transform as the main canvas
// (as a sibling, like SelectionOverlay and the checkerboard), so the wire stays
// pinned to the pixels through any pan/zoom instead of drifting off them.
//
// SVG rather than a canvas blit because the wire is a handful of hundreds of
// points, it changes every mouse-move, and it wants a crisp 1px stroke at any
// zoom — `vectorEffect="non-scaling-stroke"` gives that for free, where a
// rasterized 1px line would go chunky the moment you zoom in.

interface Props {
  /** Frozen path behind the last anchor. Flat [x,y,…] image-space pairs. */
  committed: Int32Array | null;
  /** The live wire from the last anchor to the cursor. Flat [x,y,…] pairs. */
  preview: Int32Array | null;
  /** Image (document) dimensions — the SVG's coordinate space. */
  width: number;
  height: number;
  panOffset: { x: number; y: number };
  zoom: number;
}

/** Flat [x,y,…] pairs → an SVG `points` string. */
function toPoints(path: Int32Array | null): string {
  if (!path || path.length < 4) return "";
  const parts: string[] = [];
  for (let i = 0; i + 1 < path.length; i += 2) {
    parts.push(`${path[i]},${path[i + 1]}`);
  }
  return parts.join(" ");
}

export function LassoOverlay({
  committed,
  preview,
  width,
  height,
  panOffset,
  zoom,
}: Props) {
  const committedPts = toPoints(committed);
  const previewPts = toPoints(preview);
  if (width <= 0 || height <= 0 || (!committedPts && !previewPts)) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: "absolute",
        width,
        height,
        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
        transformOrigin: "center center",
        pointerEvents: "none",
        // Above the selection marker (24) but below the app chrome, the same
        // band PenOverlay uses.
        zIndex: 25,
        overflow: "visible",
      }}
    >
      {/* Doubled stroke — a dark casing under a light core — so the wire stays
          legible over both a bright sky and a black shadow. A single-colour
          line disappears into half the photos you'd want to trace. */}
      {committedPts && (
        <>
          <polyline
            points={committedPts}
            fill="none"
            stroke="#000"
            strokeOpacity={0.55}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={committedPts}
            fill="none"
            stroke="#fff"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
      {/* The live wire is dashed, so "frozen" vs "still chasing the cursor" is
          readable at a glance without a legend. */}
      {previewPts && (
        <>
          <polyline
            points={previewPts}
            fill="none"
            stroke="#000"
            strokeOpacity={0.55}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={previewPts}
            fill="none"
            stroke="#4d9bff"
            strokeWidth={1}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}
