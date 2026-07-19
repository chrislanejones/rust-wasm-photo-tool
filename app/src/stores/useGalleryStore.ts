// Gallery store: the photo list, active selection, and per-photo bookkeeping
// (compression savings, modified set, resume manifest, tier cap).
//
// Action names mirror AppShell's former `useState` setters exactly
// (setPhotos / setActivePhotoId / setSelectedIds / …) so the migration is a
// drop-in: every `setPhotos((prev) => …)` and friend keeps working via SetArg.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "./storage/idbStorage";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { GalleryManifest } from "@/lib/galleryManifest";
import { DEFAULT_PHOTO_LIMIT } from "@/lib/photoLimits";
import { resolveSet, validatedRecord, type SetArg } from "./_shared";

interface GalleryState {
  photos: PhotoEntry[];
  activePhotoId: string | null;
  /** Multi-select set for batch operations. */
  selectedIds: Set<string>;
  /** photoId → last measured compression savings. */
  imageSavings: Record<string, { savingsPercent: number }>;
  /** Ids of photos edited this session (drives the "modified" dot). */
  modifiedPhotos: Set<string>;
  /** Whether the ACTIVE image has unsaved edits this session (drives the compare
   *  gate + save-on-switch). Sits next to modifiedPhotos as edit bookkeeping. */
  hasBeenModified: boolean;
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
  setHasBeenModified: (v: SetArg<boolean>) => void;
  setMaxPhotos: (v: SetArg<number>) => void;
  setResumeManifest: (v: SetArg<GalleryManifest | null>) => void;
}

export const useGalleryStore = create<GalleryState>()(
  persist(
    (set) => ({
  photos: [],
  activePhotoId: null,
  selectedIds: new Set(),
  imageSavings: {},
  modifiedPhotos: new Set(),
  hasBeenModified: false,
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
  setHasBeenModified: (v) =>
    set((s) => ({ hasBeenModified: resolveSet(v, s.hasBeenModified) })),
  setMaxPhotos: (v) => set((s) => ({ maxPhotos: resolveSet(v, s.maxPhotos) })),
  setResumeManifest: (v) =>
    set((s) => ({ resumeManifest: resolveSet(v, s.resumeManifest) })),
    }),
    {
      name: "image-horse-gallery-v1",
      storage: createJSONStorage(() => idbStorage),
      // ONLY the savings map. The photo list itself is rebuilt from the gallery
      // manifest (it carries the thumbnails and content keys); persisting it
      // here too would be a second, competing source of truth. `selectedIds` and
      // `modifiedPhotos` are Sets — they don't survive JSON — and they're
      // per-session state anyway.
      //
      // Why this exists: the Zap savings badge is keyed by photo id and lived
      // only in memory, so every reload silently dropped it even though the
      // photo it describes was restored from IndexedDB. Purely additive — a
      // missing key rehydrates to `{}`, so no migration is needed.
      partialize: (s): Partial<GalleryState> => ({
        imageSavings: s.imageSavings,
      }),
      // Same hydration guard as the other persisted stores (runs every
      // rehydrate, not just on a version bump). imageSavings has no fixed key
      // set — it's keyed by photo id — so this only checks it's actually a
      // plain object; a corrupted/non-object blob falls back to `{}` rather
      // than rehydrating as something the savings badge can't read.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GalleryState>;
        return {
          ...current,
          imageSavings: p.imageSavings
            ? (validatedRecord(p.imageSavings) as GalleryState["imageSavings"])
            : current.imageSavings,
        };
      },
    },
  ),
);
