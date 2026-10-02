// The Tools card's FOOTER: one line saying which photo the card is looking at
// — "3 of 12 · IMG_2041.jpg".
//
// It used to be `PerPhotoRegion`'s first job, rendered inside the scrolling
// body and only for the five per-photo tools, on the reasoning that "your brush
// doesn't belong to a photo". Chris asked for it everywhere (10-02-2026: "needs
// to be at the bottom of tools - as a footer of the card that tools is - and it
// need to be in all the"), which is a different claim and a fair one: as a
// CARD footer it is ambient context for the whole panel, not a label on the
// controls above it. So it is a sibling of the scrolling body now, pinned to
// the card's foot, on every tool.
//
// Two things follow from being outside that body rather than inside it:
//
//   • it never scrolls away — the question "whose values am I editing" is
//     answerable without scrolling to the end of a long panel;
//   • it stays readable and legible during a photo switch for free. The old
//     line was inside PerPhotoRegion's `inert` region and had to be carved
//     back out of the skeleton CSS by name (`:not(.per-photo-name)`); now it
//     is simply not in there.
//
// It keeps the switch CUE: the line re-highlights (~400 ms fade) each time the
// photo changes, so a switch never looks like nothing happened. Reduced motion
// gets the same highlight held static — see `.per-photo-name-flash`.
import { useEffect, useRef, useState } from "react";
import { useGalleryStore } from "@/stores/useGalleryStore";

export function PhotoFooter() {
  const photos = useGalleryStore((s) => s.photos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const index = photos.findIndex((p) => p.id === activePhotoId);
  const name = index >= 0 ? photos[index]!.name : null;

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

  // No photo, no footer — the card keeps its own bottom inset either way, so
  // nothing moves when the first photo lands.
  if (!name) return null;
  return (
    <p
      key={flash}
      className={`per-photo-name truncate ${flash ? "per-photo-name-flash" : ""}`}
      title={name}
    >
      {`${index + 1} of ${photos.length} · ${name}`}
    </p>
  );
}
