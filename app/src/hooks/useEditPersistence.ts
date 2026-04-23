import { useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { useConvex, useMutation } from "convex/react";
import { api } from "../../../.convex/_generated/api";
import type { RefObject } from "react";
import type { CloneStampTool } from "stamp_tool";
import {
  savePhotoEdit as idbSave,
  loadPhotoEdit as idbLoad,
  deletePhotoEdit as idbDelete,
  clearAllEdits as idbClear,
} from "@/lib/editPersistence";
import type { SavedEdit } from "@/lib/editPersistence";

export function useEditPersistence() {
  const { isSignedIn } = useUser();
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.photoEdits.generateUploadUrl);
  const saveEdit = useMutation(api.photoEdits.save);
  const removeEdit = useMutation(api.photoEdits.remove);
  const clearAllConvex = useMutation(api.photoEdits.clearAll);

  const savePhotoEdit = useCallback(
    async (photoId: string, toolRef: RefObject<CloneStampTool | null>) => {
      if (isSignedIn) {
        const tool = toolRef.current;
        if (!tool) return;
        const png = tool.export_png();
        const uploadUrl = await generateUploadUrl();
        const resp = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: new Blob([png as unknown as ArrayBuffer]),
        });
        const { storageId } = await resp.json() as { storageId: string };
        await saveEdit({
          photoKey: photoId,
          storageId: storageId as any,
          canvasW: tool.width(),
          canvasH: tool.height(),
        });
      } else {
        await idbSave(photoId, toolRef);
      }
    },
    [isSignedIn, generateUploadUrl, saveEdit],
  );

  const loadPhotoEdit = useCallback(
    async (photoId: string): Promise<SavedEdit | null> => {
      if (isSignedIn) {
        const edit = await convex.query(api.photoEdits.getEdit, {
          photoKey: photoId,
        });
        if (!edit?.downloadUrl) return null;
        const resp = await fetch(edit.downloadUrl);
        const buffer = await resp.arrayBuffer();
        return {
          canvasW: edit.canvasW,
          canvasH: edit.canvasH,
          canvasPng: new Uint8Array(buffer),
          undoStack: [],
          redoStack: [],
        };
      } else {
        return await idbLoad(photoId);
      }
    },
    [isSignedIn, convex],
  );

  const deletePhotoEdit = useCallback(
    async (photoId: string) => {
      if (isSignedIn) {
        await removeEdit({ photoKey: photoId });
      } else {
        await idbDelete(photoId);
      }
    },
    [isSignedIn, removeEdit],
  );

  const clearAllEdits = useCallback(async () => {
    if (isSignedIn) {
      await clearAllConvex();
    } else {
      await idbClear();
    }
  }, [isSignedIn, clearAllConvex]);

  return { savePhotoEdit, loadPhotoEdit, deletePhotoEdit, clearAllEdits };
}
