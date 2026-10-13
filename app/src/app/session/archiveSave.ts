import { setSaveFailed } from "@/lib/saveStatus";
import { logDiagnostic } from "@/lib/diagnosticsLog";

/** Publish success only after a real archive write; a refusal is not a save. */
export async function writeEditArchive(
  id: string,
  write: () => Promise<boolean>,
  markSaved: () => void,
): Promise<boolean> {
  try {
    if (await write() !== true) return false;
    markSaved();
    setSaveFailed(false, id, "archive");
    return true;
  } catch (err) {
    setSaveFailed(true, id, "archive");
    logDiagnostic("CONSOLE", `Autosave failed for ${id}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
