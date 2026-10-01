// The frame around a PER-PHOTO panel (Resize, Adjustments, Levels, Presets,
// Crop & Transform, Perspective, Layers & Canvas Size) — skeleton plan §1–§3.
//
// Three jobs:
//   1. SAY WHOSE VALUES THESE ARE. A line naming the photo — "3 of 12 ·
//      IMG_2041.jpg". If the name is there, the numbers are that photo's.
//      Per-TOOL panels (brush, shapes, text, stamp, select) get no name: your
//      brush doesn't belong to a photo.
//   2. CUE EVERY SWITCH. The line re-highlights (~400 ms fade) each time the
//      photo changes, fast or slow, so a switch never looks like nothing
//      happened. Reduced motion: the same highlight, held static, no fade.
//   3. LOCK DURING A SWITCH. From the moment you ask for a photo until its
//      pixels are in the engine, these controls would read or edit the
//      previous photo, so they are `inert`. If that takes longer than 300 ms
//      the controls turn into skeletons IN PLACE (CSS on
//      `data-switch-skeleton`): every box keeps its exact size, nothing moves
//      when the real values return.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useDelayedFlag, usePhotoSwitching } from "@/hooks/usePhotoSwitching";
import { logDiagnostic } from "@/lib/diagnosticsLog";

/** A switch that never ends must not lock the panel forever (a load that
 *  failed, an original that went missing). Past this, unlock and log. */
const SWITCH_LOCK_MAX_MS = 15_000;

export function PerPhotoRegion({ enabled = true, children }: { enabled?: boolean; children: ReactNode }) {
  const photos = useGalleryStore((s) => s.photos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const index = photos.findIndex((p) => p.id === activePhotoId);
  const name = index >= 0 ? photos[index]!.name : null;

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

  // Re-trigger the highlight on every change of photo. A key on the line
  // restarts its CSS animation without any timer bookkeeping.
  const [flash, setFlash] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setFlash((n) => n + 1);
  }, [activePhotoId]);

  if (!enabled || !name) return <>{children}</>;
  return (
    <div
      aria-busy={locked || undefined}
      inert={locked || undefined}
      data-switch-skeleton={(locked && slow) || undefined}
      className="per-photo-region"
    >
      {locked && slow && (
        <span role="status" className="sr-only">
          {`Loading ${name}…`}
        </span>
      )}
      {children}
      {/* The name sits UNDER the controls, in the same footer treatment as the
          Layers panel's "Photo · no shapes or text" (Chris, 09-30-2026): a
          rule, then muted text, nothing bold. It answers "whose values are
          these" when you go looking, instead of taking the top of every panel.
          The switch highlight still plays here — it is the cue that a photo
          changed, and it reads the same at the bottom. */}
      <p
        key={flash}
        className={`per-photo-name truncate ${flash ? "per-photo-name-flash" : ""}`}
        title={name}
      >
        {`${index + 1} of ${photos.length} · ${name}`}
      </p>
    </div>
  );
}
