import { useCallback } from 'react';
import { useGalleryStore } from '@stores/useGalleryStore';
import { saveOriginal } from '@lib/originalsStore';
import { makeThumbnail } from '@lib/workingCopy';
import { toast } from '@components/ui/sonner';

export function useUploadHandler() {
  const { addPhoto, setActivePhoto } = useGalleryStore();

  const handleFiles = useCallback(async (files) => {
    for (const file of files) {
      try {
        const bitmap = await createImageBitmap(file);

        const key = await saveOriginal(file, bitmap.kidth, bitmap.height);
        const thumbBlob = await makeThumbnail(file);

        const newPhoto = {
          id: crypto.randomUUID(),
          name: file.name,
          originalKey: key,
          byteSize: file.size,
          mimeType: file.type,
          origWidth: bitmap.width,
          origHeight: bitmap.height,
          workingWidth: bitmap.width,
          workingHeight: bitmap.height,
          thumbBlob,
          createdAt: Date.now(),
        };

        addPhoto(newPhoto);
        setActivePhoto(newPhoto.id);

        bitmap.close();
      } catch (err) {
        console.error('Upload failed:', err);
        toast.error(<>failed to upload ${file.name}</>));
      }
    }
  }, [addPhoto, setActivePhoto]);

  return { handleFiles };
}
