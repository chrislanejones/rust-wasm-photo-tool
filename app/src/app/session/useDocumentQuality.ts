import { useEffect, useRef } from "react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useToolStore } from "@/stores/useToolStore";
import { useLoadedDocument } from "@/hooks/useLoadedDocument";

/** The slider is a draft. Loaded documents and history moves restore the
 * engine's applied value; moving the draft never writes into the engine. */
export function useDocumentQuality(state: { ready: boolean; exportQuality: number }) {
  const doc = useLoadedDocument(state);
  const revision = useGalleryStore((s) => s.documentRevision);
  const quality = useToolStore((s) => s.quality);
  const synced = useRef<string | null>(null);
  const setQuality = useToolStore((s) => s.setQuality);
  const applied = doc?.ready ? doc.exportQuality : null;
  const key = applied === null ? null : `${revision}:${applied}`;
  useEffect(() => {
    if (applied !== null) {
      synced.current = key;
      setQuality(applied);
    }
  }, [applied, key, setQuality]);
  return applied !== null && synced.current !== key ? applied : quality;
}
