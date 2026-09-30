// Which ONE status mark a gallery thumbnail wears (UI Night 6 §1).
//
// A thumbnail stays a photo. State is a small corner mark, never a spinner
// laid over the image — and never two marks, which would make the corner of a
// photo into a status report. So this picks exactly one, by priority, and says
// nothing at all for the calm default.
//
//   failed  >  conflict  >  changed elsewhere  >  working  >  backed up
//
// "Changed elsewhere" is not in the plan's four-step list; it sits with
// `working` because it shares the ↻ glyph, and just above it because it
// carries more news — something happened you did not do here.
//
// LOCAL SHOWS NOTHING. Most people are local-only, and a gallery full of "•"
// marks would make everyone look like they are missing something. No mark is
// the calm state, and it is the default.
//
// BACKEND (Night 6 §0 inventory, measured 09-28): only the edit backup exists,
// and it has no list query — so today the gallery cannot know `backedUp` for
// every thumbnail without N per-photo queries. Every other flag here has no
// backend at all. This module is fully tested against fixtures and wired to
// nothing; the flags arrive as the backend tracks land.

import type { StatusKind } from "@/components/ui/status-mark";

/** What the app knows about one photo's cloud state. All optional — absent is
 *  "no", which is also what a local-only photo looks like. */
export interface GalleryPhotoState {
  uploadFailed?: boolean;
  conflict?: boolean;
  changedElsewhere?: boolean;
  uploading?: boolean;
  backedUp?: boolean;
}

/** Who is looking — the same flag can mean nothing to one viewer. */
export interface GalleryViewer {
  signedIn: boolean;
  paid: boolean;
  /** The online-features switch: off, nothing is being sent, so nothing about
   *  sending can be shown. */
  cloudAllowed: boolean;
}

export type GalleryMarkId = "failed" | "conflict" | "changedElsewhere" | "working" | "backedUp";

export interface GalleryMark {
  id: GalleryMarkId;
  /** StatusMark's glyph for it. */
  kind: StatusKind;
  /** The accessible name. The mark is decoration to a sighted user and the
   *  whole story to everyone else, so every one has words. */
  label: string;
  /** Only `changedElsewhere`: the ↻ carries a dot, so it reads differently
   *  from a plain upload in progress. */
  dot?: boolean;
  /** Only `conflict`: the mark is a door, not a label (§1 "conflict gets a
   *  door"). */
  opensMenu?: boolean;
}

const ORDER: readonly {
  id: GalleryMarkId;
  has: (s: GalleryPhotoState) => boolean;
  shownTo: (v: GalleryViewer) => boolean;
  mark: Omit<GalleryMark, "id">;
}[] = [
  {
    id: "failed",
    has: (s) => !!s.uploadFailed,
    shownTo: (v) => v.signedIn,
    mark: { kind: "failed", label: "Upload failed: retry" },
  },
  {
    id: "conflict",
    has: (s) => !!s.conflict,
    shownTo: (v) => v.paid,
    mark: {
      kind: "attention",
      label: "Changed in two places: choose a version",
      opensMenu: true,
    },
  },
  {
    id: "changedElsewhere",
    has: (s) => !!s.changedElsewhere,
    shownTo: (v) => v.paid,
    mark: { kind: "working", label: "Changed on another device", dot: true },
  },
  {
    id: "working",
    has: (s) => !!s.uploading,
    shownTo: (v) => v.signedIn && v.cloudAllowed,
    mark: { kind: "working", label: "Uploading" },
  },
  {
    id: "backedUp",
    has: (s) => !!s.backedUp,
    shownTo: (v) => v.paid && v.cloudAllowed,
    mark: { kind: "backedUp", label: "Backed up" },
  },
];

/** The one mark this thumbnail wears, or null for the calm default. */
export function pickGalleryMark(state: GalleryPhotoState, viewer: GalleryViewer): GalleryMark | null {
  for (const row of ORDER) {
    if (row.has(state) && row.shownTo(viewer)) return { id: row.id, ...row.mark };
  }
  return null;
}

/** The three ways out of a conflict. "Newest wins, the loser is kept" is the
 *  decided rule; this is the menu that lets a person overrule it. */
export const CONFLICT_CHOICES = [
  { id: "keepThis", label: "Keep this one" },
  { id: "useOther", label: "Use the other version" },
  { id: "keepBoth", label: "Keep both" },
] as const;
export type ConflictChoice = (typeof CONFLICT_CHOICES)[number]["id"];
