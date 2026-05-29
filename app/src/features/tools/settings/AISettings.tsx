// AI tool panel — Coming Soon placeholders for future AI features.
// Modeled after BatchSettings's Text-tab "Coming Soon" button style.
import { Type, Scissors, Sparkles, Eraser } from "lucide-react";

interface AIFeature {
  title: string;
  description: string;
  Icon: typeof Type;
}

const FEATURES: AIFeature[] = [
  {
    title: "Text Extract (OCR)",
    description:
      "Drag a region; Tesseract.js / Replicate reads the text back. Saved into the Recent Texts list for re-use.",
    Icon: Type,
  },
  {
    title: "Background Removal",
    description:
      "One-click background isolation powered by rembg, run via Replicate.",
    Icon: Scissors,
  },
  {
    title: "4× Upscale",
    description: "Enhance resolution with Real-ESRGAN.",
    Icon: Sparkles,
  },
  {
    title: "Object Removal",
    description: "Brush over objects to remove them with SD Inpaint.",
    Icon: Eraser,
  },
];

export function AISettings() {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
        AI Tools
      </h3>

      {FEATURES.map(({ title, description, Icon }) => (
        <div
          key={title}
          className="flex items-start gap-3 p-3 rounded-lg bg-bg-elevated/50 border border-border/50 opacity-60"
        >
          <Icon className="h-5 w-5 shrink-0 text-text-primary/80" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary">
                {title}
              </span>
              <span className="rounded-full bg-theme-muted/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-theme-foreground/70">
                Coming Soon
              </span>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      ))}

      <p className="text-[10px] text-text-muted/60 text-center pt-2">
        Coming soon — Replicate + Convex pipeline
      </p>
    </div>
  );
}
