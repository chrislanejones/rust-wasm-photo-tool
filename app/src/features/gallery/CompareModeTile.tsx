// Compare two photos, in the compact layout (11-15-2026). At ≤ 1000 px the
// master bar replaces the top bar, and the top bar's Compare two photos went
// with it, so compare mode could only start at desktop width. The master
// bar's own strip has no room for it: eight 30px buttons need 240 px, and the
// 252 px strip has 238 inside its border and padding. So the entry is a tile
// in the docked Gallery tab, where the picking happens, beside Select ▾.
//
// The SAME action as the top bar's button (comparePick's toggleCompareMode),
// so the two layouts cannot drift. No `data-compare-keep` of its own: the
// whole gallery carries it, so tapping this is never the "click elsewhere"
// that ends compare mode before the tap's own toggle runs.
//
// The label flips to what a tap does now, as the top bar's tooltip does. A
// changing name says the state, so no `aria-pressed` on top of it.
import { GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleCompareMode } from "@/features/canvas/comparePick";
import { useScreenshotCompareStore } from "@/stores/useScreenshotCompareStore";

export function CompareModeTile({ className, labelClassName }: { className?: string; labelClassName?: string }) {
  // On while compare mode is picking or two photos are compared — the same
  // test as the top bar's button.
  const comparing = useScreenshotCompareStore((s) => s.picking || s.otherId !== null);
  return (
    <Button
      size="default"
      onClick={() => toggleCompareMode("dock")}
      // The name contains the visible word (label-in-name): "Compare" shows,
      // "Compare two photos" is read; "Stop comparing" is both.
      aria-label={comparing ? "Stop comparing" : "Compare two photos"}
      title={comparing ? "Stop comparing" : "Compare two photos"}
      className={className}
    >
      <GitCompareArrows className="h-3.5 w-3.5" />
      <span className={labelClassName}>{comparing ? "Stop comparing" : "Compare"}</span>
    </Button>
  );
}
