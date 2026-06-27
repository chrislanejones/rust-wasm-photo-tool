import { Move, MousePointer2, Layers } from "lucide-react";
import type { ToolSettings } from "@/lib/types";

// The `arrow` tool slot is now the Move tool — drag to reposition the active
// layer's contents. It has no adjustable settings yet, so this panel is a short
// how-to. (Export name kept as `ArrowSettings` so the sidebar mount is unchanged.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ArrowSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
}

export function ArrowSettings(_props: ArrowSettingsProps) {
  return (
    <div className="space-y-4" data-draw-panel>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-theme-muted/50 bg-theme-muted/20 px-4 py-6 text-center">
        <Move className="h-8 w-8 text-theme-primary" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-theme-foreground">Move</p>
          <p className="max-w-[210px] text-2xs leading-relaxed text-theme-muted-foreground">
            Drag anywhere on the canvas to reposition the{" "}
            <span className="font-semibold text-theme-foreground">active layer</span>{" "}
            — its pixels and any text or shapes on it move together.
          </p>
        </div>
      </div>

      <ul className="space-y-2.5 text-2xs leading-relaxed text-theme-muted-foreground">
        <li className="flex items-start gap-2.5">
          <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-theme-primary" />
          <span>
            Pick which layer moves in the{" "}
            <span className="font-semibold text-theme-foreground">Layers</span>{" "}
            panel — only the active one is dragged.
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <MousePointer2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-theme-primary" />
          <span>
            Paste an image, then switch here to nudge it into place. Each drag is
            a single undo step.
          </span>
        </li>
      </ul>
    </div>
  );
}
