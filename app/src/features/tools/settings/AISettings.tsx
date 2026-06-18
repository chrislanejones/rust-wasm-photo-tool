// AI tool panel. Background Removal and Text Extract (OCR) are wired to the
// Replicate + Convex pipeline (useAIJob); the remaining models are still
// Coming Soon placeholders until the same plumbing is cloned for them.
import { useState } from "react";
import { Type, Scissors, Sparkles, Eraser, Lock, Loader2, Copy } from "lucide-react";
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
    title: "4x Upscale",
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

/** AI tools are Replicate-backed -> Paid tier only (see lib/tiers.ts). */
export function AISettings({
  aiEnabled = false,
  activePhotoId,
  stampToolRef,
  onAIResult,
}: AISettingsProps) {
  const { run, phase, busy, error, textResult } = useAIJob(onAIResult);
  const [lastType, setLastType] = useState<"rembg" | "ocr" | null>(null);
  const [copied, setCopied] = useState(false);

  const canRun = aiEnabled && !!activePhotoId && !!stampToolRef.current;

  const runModel = (type: "rembg" | "ocr") => {
    const tool = stampToolRef.current;
    if (!tool || !activePhotoId) return;
    const png = new Uint8Array(tool.export_png());
    setCopied(false);
    setLastType(type);
    void run(type, activePhotoId, png);
  };

  const copyText = async () => {
    if (!textResult) return;
    try {
      await navigator.clipboard.writeText(textResult);
      setCopied(true);
    } catch {
      /* clipboard blocked - no-op */
    }
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
            Upgrade to unlock background removal, text extraction, and more.
          </p>
        </div>
      )}

      {/* Background Removal (live) */}
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
          onClick={() => runModel("rembg")}
          disabled={!canRun || busy}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && lastType === "rembg" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          {lastType === "rembg" && phase === "uploading"
            ? "Uploading..."
            : lastType === "rembg" && phase === "running"
              ? "Removing background..."
              : "Remove Background"}
        </button>
        {lastType === "rembg" && error && (
          <p className="mt-2 text-[10px] text-red-400 leading-relaxed">{error}</p>
        )}
        {lastType === "rembg" && phase === "done" && !error && (
          <p className="mt-2 text-[10px] text-emerald-400">
            Background removed - applied to canvas.
          </p>
        )}
      </div>

      {/* Text Extract / OCR (live) */}
      <div className="p-3 rounded-lg bg-bg-elevated/50 border border-border/50">
        <div className="flex items-start gap-3">
          <Type className="h-5 w-5 shrink-0 text-text-primary/80" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-text-primary">
              Text Extract (OCR)
            </span>
            <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
              Read the text out of the current image, via Replicate OCR.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => runModel("ocr")}
          disabled={!canRun || busy}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && lastType === "ocr" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          {lastType === "ocr" && phase === "uploading"
            ? "Uploading..."
            : lastType === "ocr" && phase === "running"
              ? "Reading text..."
              : "Extract Text"}
        </button>
        {lastType === "ocr" && error && (
          <p className="mt-2 text-[10px] text-red-400 leading-relaxed">{error}</p>
        )}
        {lastType === "ocr" && phase === "done" && !error && (
          <div className="mt-2">
            {textResult && textResult.trim() ? (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-text-muted">
                    Extracted text
                  </span>
                  <button
                    type="button"
                    onClick={copyText}
                    className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary"
                  >
                    <Copy className="h-3 w-3" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-black/20 border border-border/50 p-2 text-[10px] text-text-primary leading-relaxed">
                  {textResult}
                </pre>
              </>
            ) : (
              <p className="text-[10px] text-text-muted">No text detected.</p>
            )}
          </div>
        )}
      </div>

      {/* Still placeholders */}
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
