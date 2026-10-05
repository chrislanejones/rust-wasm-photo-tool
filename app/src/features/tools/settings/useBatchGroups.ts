import { useEffect, useMemo } from "react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import {
  groupOf,
  splitGroups,
  useBatchGroupStore,
  type BatchGroup,
} from "@/stores/useBatchGroupStore";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

/** The split, and the group the panel is on. With nothing ticked there are no
 *  exceptions, so the group is always Main. Switching photos moves to the
 *  group of the photo on screen. */
export function useBatchGroups(photos: PhotoEntry[], activePhotoId: string | null) {
  const exceptionIds = useGalleryStore((s) => s.selectedIds);
  const groups = useMemo(() => splitGroups(exceptionIds, photos), [exceptionIds, photos]);
  const hasExceptions = groups.exceptions.length > 0;
  const stored = useBatchGroupStore((s) => s.group);
  const setGroup = useBatchGroupStore((s) => s.setGroup);
  const activeGroup: BatchGroup = activePhotoId ? groupOf(exceptionIds, activePhotoId) : "main";
  useEffect(() => {
    setGroup(activeGroup);
  }, [activePhotoId, activeGroup, setGroup]);
  const group: BatchGroup = hasExceptions ? stored : "main";
  return { exceptionIds, groups, hasExceptions, group, stored, setGroup, activeGroup };
}

/** "All Images" while a group is the whole gallery, else the count — so a
 *  Batch button never claims All while the Exceptions are left out. */
export function useWhoLabel() {
  const total = useGalleryStore((s) => s.photos.length);
  return (n: number) => (n === total ? "All Images" : `${n} Image${n === 1 ? "" : "s"}`);
}
