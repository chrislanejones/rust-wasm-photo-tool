import { ImagePlus, Layers, Sparkles } from "lucide-react";

export function BatchSettings() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-theme-muted/50 bg-theme-muted/20 px-4 py-10 text-center">
        <div className="flex items-center justify-center gap-2">
          <ImagePlus className="h-5 w-5 text-theme-muted-foreground" />
          <Layers className="h-5 w-5 text-theme-muted-foreground" />
          <Sparkles className="h-5 w-5 text-theme-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-theme-foreground">
            Icon Batch Stamp
          </p>
          <span className="inline-block rounded-full bg-theme-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-theme-primary">
            Coming Soon
          </span>
        </div>
        <p className="max-w-[220px] text-[11px] text-theme-muted-foreground leading-relaxed">
          Select any Lucide icon and stamp it across all images at once —
          pinned to the bottom of every photo, with optional label text
          beneath it.
        </p>
        <div className="w-full space-y-2 text-left">
          <p className="text-[10px] font-bold uppercase tracking-widest text-theme-muted-foreground">
            Planned features
          </p>
          {[
            "Pick any Lucide icon by name",
            "Batch-stamp all loaded images",
            "Position: bottom-left, center, bottom-right",
            "Optional label text below icon",
            "Size & color controls",
          ].map((f) => (
            <div key={f} className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-theme-muted-foreground/50" />
              <span className="text-[10px] text-theme-muted-foreground">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
