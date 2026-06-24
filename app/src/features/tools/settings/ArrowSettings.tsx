import { FileText } from "lucide-react";
import type { ToolSettings } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ArrowSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
}

export function ArrowSettings(_props: ArrowSettingsProps) {
  return (
    <div className="space-y-6" data-draw-panel>
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-theme-muted/50 bg-theme-muted/20 px-4 py-10 text-center">
        <FileText className="h-8 w-8 text-theme-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-theme-foreground">
            Coming Soon
          </p>
          <span className="inline-block rounded-full bg-theme-primary/15 px-2.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-theme-primary">
            In Development
          </span>
        </div>
        <p className="max-w-[200px] text-2xs text-theme-muted-foreground leading-relaxed">
          Something new is planned for this section. Stay tuned.
        </p>
      </div>
    </div>
  );
}
