// Small, testable pieces of useImageSession's user feedback, kept out of the
// hook so it stays under its line budget.
import { toast } from "@/components/ui/sonner";
import { logDiagnostic } from "@/lib/diagnosticsLog";
import { useGalleryStore } from "@/stores/useGalleryStore";

/** List `files` as pending imports (skeleton tiles, Plan A §5). Returns
 *  `settle(i)`, called when file i lands or fails. */
export function beginPendingImports(files: readonly File[]): (i: number) => void {
  const pending = files.map((f) => ({
    id: `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: f.name,
  }));
  const { setPendingImports } = useGalleryStore.getState();
  setPendingImports((prev) => [...prev, ...pending]);
  return (i) => setPendingImports((prev) => prev.filter((p) => p.id !== pending[i]!.id));
}

/** A photo switch that really failed (not a superseded one): the Error state —
 *  what failed, and a way out (Plan C §3). */
export function reportSwitchFailure(name: string, err: unknown, retry: () => void): void {
  logDiagnostic("UI_THREAD", `switch to ${name} failed: ${String(err)}`);
  toast.error(`Couldn't open ${name}.`, { action: { label: "Try again", onClick: retry } });
}
