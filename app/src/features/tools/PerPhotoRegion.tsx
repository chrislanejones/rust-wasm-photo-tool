// The frame around a PER-PHOTO panel (Resize, Adjustments, Levels, Presets,
// Crop & Transform, Perspective, Layers & Canvas Size) — skeleton plan §1–§3.
//
// ONE job now: LOCK DURING A SWITCH. From the moment you ask for a photo until
// its pixels are in the engine, these controls would read or edit the previous
// photo, so they are `inert`. If that takes longer than 300 ms the controls
// turn into skeletons IN PLACE (CSS on `data-skeleton-region`, the one rule the
// gallery card shares): every box keeps its exact size, nothing moves when the
// real values return. `data-switch-skeleton` is the old name, still emitted as
// an alias because e2e/photo-switch-cue.spec.ts observes it.
//
// Its other two jobs — naming the photo and cueing every switch — went to
// `PhotoFooter`, which is the Tools CARD's footer rather than a line inside
// each per-photo panel (Chris, 10-02-2026). That is why the gate here is still
// per-tool while the name is now on every tool: a brush panel has no values to
// lock to a photo, but the card it sits in is still looking at one.
import { useEffect, type ReactNode } from "react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useDelayedFlag, usePhotoSwitching } from "@/hooks/usePhotoSwitching";
import { logDiagnostic } from "@/lib/diagnosticsLog";

/** A switch that never ends must not lock the panel forever (a load that
 *  failed, an original that went missing). Past this, unlock and log. */
const SWITCH_LOCK_MAX_MS = 15_000;

export function PerPhotoRegion({ enabled = true, children }: { enabled?: boolean; children: ReactNode }) {
  const photos = useGalleryStore((s) => s.photos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const name = photos.find((p) => p.id === activePhotoId)?.name ?? null;

  const switching = usePhotoSwitching();
  const slow = useDelayedFlag(switching, 300);
  const stuck = useDelayedFlag(switching, SWITCH_LOCK_MAX_MS);
  useEffect(() => {
    if (stuck) {
      logDiagnostic(
        "CONSOLE",
        `Photo switch to ${activePhotoId} did not finish in ${SWITCH_LOCK_MAX_MS / 1000}s — panel unlocked`,
      );
    }
  }, [stuck, activePhotoId]);
  const locked = switching && !stuck;

  // No active photo, nothing to lock to — and the announcement below would
  // have no name to read out.
  if (!enabled || !name) return <>{children}</>;
  return (
    <div
      aria-busy={locked || undefined}
      inert={locked || undefined}
      data-skeleton-region={(locked && slow) || undefined}
      data-switch-skeleton={(locked && slow) || undefined}
      className="per-photo-region"
    >
      {locked && slow && (
        <span role="status" className="sr-only">
          {`Loading ${name}…`}
        </span>
      )}
      {children}
    </div>
  );
}
