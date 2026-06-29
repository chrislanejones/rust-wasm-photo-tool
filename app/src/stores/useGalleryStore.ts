// Gallery store: the photo list, active selection, and per-photo bookkeeping
// (compression savings, modified set, resume manifest, tier cap).
//
// Action names mirror AppShell's former `useState` setters exactly
// (setPhotos / setActivePhotoId / setSelectedIds / …) so the migration is a
// drop-in: every `setPhotos((prev) => …)` and friend keeps working via SetArg.
import { create } from "zustand";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { GalleryManifest } from "@/lib/galleryManifest";
import { DEFAULT_PHOTO_LIMIT } from "@/lib/photoLimits";
import { resolveSet, type SetArg } from "./_shared";

interface GalleryState {
  photos: PhotoEntry[];
  activePhotoId: string | null;
  /** Multi-select set for batch operations. */
  selectedIds: Set<string>;
  /** photoId → last measured compression savings. */
  imageSavings: Record<string, { savingsPercent: number }>;
  /** Ids of photos edited this session (drives the "modified" dot). */
  modifiedPhotos: Set<string>;
  /** Gallery cap for the current tier. */
  maxPhotos: number;
  /** Prior-session manifest offered on the Resume screen (null = none). */
  resumeManifest: GalleryManifest | null;

  setPhotos: (v: SetArg<PhotoEntry[]>) => void;
  setActivePhotoId: (v: SetArg<string | null>) => void;
  setSelectedIds: (v: SetArg<Set<string>>) => void;
  setImageSavings: (
    v: SetArg<Record<string, { savingsPercent: number }>>,
  ) => void;
  setModifiedPhotos: (v: SetArg<Set<string>>) => void;
  setMaxPhotos: (v: SetArg<number>) => void;
  setResumeManifest: (v: SetArg<GalleryManifest | null>) => void;
}

export const useGalleryStore = create<GalleryState>((set) => ({
  photos: [],
  activePhotoId: null,
  selectedIds: new Set(),
  imageSavings: {},
  modifiedPhotos: new Set(),
  maxPhotos: DEFAULT_PHOTO_LIMIT,
  resumeManifest: null,

  setPhotos: (v) => set((s) => ({ photos: resolveSet(v, s.photos) })),
  setActivePhotoId: (v) =>
    set((s) => ({ activePhotoId: resolveSet(v, s.activePhotoId) })),
  setSelectedIds: (v) => set((s) => ({ selectedIds: resolveSet(v, s.selectedIds) })),
  setImageSavings: (v) =>
    set((s) => ({ imageSavings: resolveSet(v, s.imageSavings) })),
  setModifiedPhotos: (v) =>
    set((s) => ({ modifiedPhotos: resolveSet(v, s.modifiedPhotos) })),
  setMaxPhotos: (v) => set((s) => ({ maxPhotos: resolveSet(v, s.maxPhotos) })),
  setResumeManifest: (v) =>
    set((s) => ({ resumeManifest: resolveSet(v, s.resumeManifest) })),
}));
