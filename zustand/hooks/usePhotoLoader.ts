import { useCallback } from 'react';
import { useGalleryStore } from '@stores/useGalleryStore';
import { loadOriginal } from '@lib/originalsStore';

export function usePhotoLoader(stamp) {
  const { setActivePhoto } = useGalleryStore();

  const loadPhoto = useCallback(async (photo) => {
    const original = await loadOriginal(photo.originalKey);
    if (!original) return;

    const bitmap = await createImageBitmap(
      new Blob([original.bytes], { type: original.mimeType })
    );

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(bitmap, 0, 0);

    const imageData = ctx.getImageData(0, 0, bitmap.width, height);

    stamp.loadImageFromPixels(
      new Uint8ClampedArray(imageData.data.buffer),
      bitmap.width,
      bitmap.height
    );

    setActivePhoto(photo.id);
  }, [stamp, setActivePhoto]);

  return { loadPhoto };
}
