import { useCallback } from "react";
import { useConvexAuth, useConvex, useMutation } from "convex/react";
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
  // Use Convex's own auth state rather than Clerk's isSignedIn. isAuthenticated
  // stays false until the JWT handshake with Convex succeeds, so mismatched keys
  // (dev Clerk vs prod Convex) keep the app on the local IDB path rather than
  // crashing with auth / function-not-found errors.
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.photoEdits.generateUploadUrl);
  const saveEdit = useMutation(api.photoEdits.save);
  const removeEdit = useMutation(api.photoEdits.remove);
  const clearAllConvex = useMutation(api.photoEdits.clearAll);

  const savePhotoEdit = useCallback(
    async (photoId: string, toolRef: RefObject<CloneStampTool | null>) => {
      if (isAuthenticated) {
        try {
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
          return;
        } catch {
          // fall through to IDB
        }
      }
      await idbSave(photoId, toolRef);
    },
    [isAuthenticated, generateUploadUrl, saveEdit],
  );

  const loadPhotoEdit = useCallback(
    async (photoId: string): Promise<SavedEdit | null> => {
      if (isAuthenticated) {
        try {
          const edit = await convex.query(api.photoEdits.getEdit, {
            photoKey: photoId,
          });
          if (edit?.downloadUrl) {
            const resp = await fetch(edit.downloadUrl);
            const buffer = await resp.arrayBuffer();
            return {
              canvasW: edit.canvasW,
              canvasH: edit.canvasH,
              canvasPng: new Uint8Array(buffer),
              undoStack: [],
              redoStack: [],
            };
          }
        } catch {
          // fall through to IDB
        }
      }
      return await idbLoad(photoId);
    },
    [isAuthenticated, convex],
  );

  const deletePhotoEdit = useCallback(
    async (photoId: string) => {
      if (isAuthenticated) {
        try {
          await removeEdit({ photoKey: photoId });
          return;
        } catch {
          // fall through to IDB
        }
      }
      await idbDelete(photoId);
    },
    [isAuthenticated, removeEdit],
  );

  const clearAllEdits = useCallback(async () => {
    if (isAuthenticated) {
      try {
        await clearAllConvex();
        return;
      } catch {
        // fall through to IDB
      }
    }
    await idbClear();
  }, [isAuthenticated, clearAllConvex]);

  return { savePhotoEdit, loadPhotoEdit, deletePhotoEdit, clearAllEdits };
}
