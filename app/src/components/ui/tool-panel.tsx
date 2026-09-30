// The vertical rhythm of one tool panel's body: header, controls, Advanced,
// action bar, 16px apart. Nothing else — no padding (the sidebar owns the
// inset), no border, no scroll.
//
// WHY A COMPONENT FOR ONE CLASS. Night 3 measured three panels with three
// frames: Paint (via ToolModeToggle) stacked at 16px, Eraser at 16px, and
// Crop at 12px with a `-mt-2` that pulled its header 8px above the other two
// — a leftover from the icon row that moved to the sidebar header, which
// ToolModeToggle had already dropped and Crop never did. The number lived in
// each panel, so each panel picked its own. It lives here now.
import * as React from "react";
import { cn } from "@/lib/utils";

export function ToolPanel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="tool-panel" className={cn("space-y-4", className)} {...props} />;
}
