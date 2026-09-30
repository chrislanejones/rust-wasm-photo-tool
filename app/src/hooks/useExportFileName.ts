import { useState } from "react";
import { defaultExportStem, sanitizeExportStem } from "@/lib/exportFileName";

/**
 * The export dialog's "File name" draft. `null` means untouched, so the field
 * shows the `<name>-revised` default. Cleared whenever the dialog opens,
 * closes or switches photo — adjusting state during render rather than in an
 * effect, so a stale name never paints for a frame.
 */
export function useExportFileName(
  open: boolean,
  photoId: string | null | undefined,
  photoName: string | undefined,
) {
  const defaultStem = defaultExportStem(photoName);
  const [draft, setDraft] = useState<string | null>(null);
  const key = open ? (photoId ?? null) : null;
  const [draftFor, setDraftFor] = useState(key);
  if (draftFor !== key) {
    setDraftFor(key);
    setDraft(null);
  }
  return {
    value: draft ?? defaultStem,
    defaultStem,
    onChange: setDraft,
    /** The stem to download under: the typed name, cleaned, or the default
     *  when nothing usable was typed. */
    stem: () => sanitizeExportStem(draft ?? "") ?? defaultStem,
  };
}
