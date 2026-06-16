// AI tool panel. Background Removal is wired to the Replicate + Convex
// pipeline (useAIJob); the remaining models are still Coming Soon placeholders
// until the same plumbing is cloned for them.
import { Type, Scissors, Sparkles, Eraser, Lock, Loader2 } from "lucide-react";
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { useAIJob, type AIResultPixels } from "@/hooks/useAIJob";

interface AIFeature {
  title: string;
  description: string;
  Icon: typeof Type;
}

const COMING_SOON: AIFeature[] = [
  {
    title: "Text Extract (OCR)",
    description:
      "Drag a region; Tesseract.js / Replicate reads the text back. Saved into the Recent Texts list for re-use.",
    Icon: Type,
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

interface AISettingsProps {
  aiEnabled?: boolean;
  activePhotoId: string | null;
  stampToolRef: MutableRefObject<ImageHorseTool | null>;
  /** Called with decoded RGBA pixels when an image model finishes. */
  onAIResult: (r: AIResultPixels) => void;
}

/** AI tools are Replicate-backed → Paid tier only (see lib/tiers.ts). */
export function AISettings({
  aiEnabled = false,
  activePhotoId,
  stampToolRef,
  onAIResult,
}: AISettingsProps) {
  const { run, phase, busy, error } = useAIJob(onAIResult);

  const canRun = aiEnabled && !!activePhotoId && !!stampToolRef.current;

  const runRembg = () => {
    const tool = stampToolRef.current;
    if (!tool || !activePhotoId) return;
    const png = new Uint8Array(tool.export_png());
    void run("rembg", activePhotoId, png);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold font-mono text-text-muted">
        AI Tools
      </h3>

      {!aiEnabled && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <Lock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <p className="text-[10px] text-amber-200/90 leading-relaxed">
            AI tools run on Replicate and are a <strong>Paid</strong> feature.
            Upgrade to unlock background removal, upscaling, and more.
          </p>
        </div>
      )}

      {/* ── Background Removal (live) ──────────────────────────────────── */}
      <div className="p-3 rounded-lg bg-bg-elevated/50 border border-border/50">
        <div className="flex items-start gap-3">
          <Scissors className="h-5 w-5 shrink-0 text-text-primary/80" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-text-primary">
              Background Removal
            </span>
            <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
              One-click background isolation powered by rembg, run via Replicate.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={runRembg}
          disabled={!canRun || busy}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {phase === "uploading"
            ? "Uploading…"
            : phase === "running"
              ? "Removing background…"
              : "Remove Background"}
        </button>
        {error && (
          <p className="mt-2 text-[10px] text-red-400 leading-relaxed">{error}</p>
        )}
        {phase === "done" && !error && (
          <p className="mt-2 text-[10px] text-emerald-400">
            Background removed — applied to canvas.
          </p>
        )}
      </div>

      {/* ── Still placeholders ─────────────────────────────────────────── */}
      {COMING_SOON.map(({ title, description, Icon }) => (
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
    </div>
  );
}
