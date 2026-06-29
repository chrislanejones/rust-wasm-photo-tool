import { useCallback } from 'react';
import { useGalleryStore } from '@stores/useGalleryStore';
import { removeOriginal } from '@lib/originalsStore';
import { toast } from '@components/ui/sonner';

export function useImageActions() {
  const { photos, activePhotoId, removePhoto, setActivePhoto } = useGalleryStore();

  const deleteCurrentPhoto = useCallback(async () => {
    if (!activePhotoId) return;

    const photo = photos.find(p => p.id === activePhotoId);
    if (!photo) return;

    try {
      await removeOriginal(photo.originalKey);
      removePhoto(activePhotoId);

      const remaining = photos.filter(p => p.id !== activePhotoId);
      if (remaining.length > 0) {
        setActivePhoto(remaining[0].id);
      } else {
        setActivePhoto(null);
      }

      toast.success('Image deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete image');
    }
  }, [activePhotoId, photos, removePhoto, setActivePhoto]);

  const duplicateCurrentPhoto = useCallback(() => {
    if (!activePhotoId) return;
    toast.info('Duplicate feature coming soon');
  }, [activePhotoId]);

  return {
    deleteCurrentPhoto,
    duplicateCurrentPhoto,
  };
}
