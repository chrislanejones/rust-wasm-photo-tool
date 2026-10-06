// The gallery card's loading frame — the gallery's `PerPhotoRegion`.
//
// It wraps the WHOLE card (header, chevrons, strip, footer) so one shimmer
// crosses it, using the same CSS rule as Tools: `[data-skeleton-region]` in
// styles.css turns every control in place into a muted block of its own size.
// The strip opts out of the muting (`data-skeleton-skip`): its tiles have their
// own skeleton-or-photo rule, and a decoded photo must stay a photo.
//
// It does NOT make anything inert itself. Only the chrome is locked; the strip
// stays scrollable and a decoded tile stays clickable. The caller puts
// `inert={loading}` on each chrome piece.
import { useMemo, type ReactNode } from "react";
import { GalleryRevealContext, type GalleryLoading } from "./useGalleryLoading";

export function GalleryLoadingRegion({
  state,
  className,
  children,
}: {
  state: GalleryLoading;
  className?: string;
  children: ReactNode;
}) {
  const { loading, holdReveal, capped, announceCount } = state;
  const reveal = useMemo(() => ({ regionLoading: loading, holdReveal, capped }), [loading, holdReveal, capped]);
  return (
    <GalleryRevealContext.Provider value={reveal}>
      <div className={className} data-gallery-card="" data-skeleton-region={loading ? "gallery" : undefined}>
        {/* The card's ONE voice. Tile skeletons are decorative and the strip's
            aria-busy stays the only busy flag; this says how many, once. */}
        {loading && (
          <span role="status" className="sr-only">
            {`Loading ${announceCount} ${announceCount === 1 ? "photo" : "photos"}…`}
          </span>
        )}
        {children}
      </div>
    </GalleryRevealContext.Provider>
  );
}
