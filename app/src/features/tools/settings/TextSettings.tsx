import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crop, Type } from "lucide-react";
import type { ToolSettings } from "@/lib/types";
import { TEXT_COLORS as COLORS } from "@/lib/colors";
import { TabGroup } from "@/components/TabGroup";
import { Button } from "@/components/ui/button";
import { quickSpring } from "@/lib/animations";

const FONT_SIZE_PRESETS = [16, 32, 48, 72] as const;

export interface TextMemory {
  id: number;
  text: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  textColor: string;
}

type TextMode = "text" | "extract";

interface TextSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
  recentTexts: TextMemory[];
  onSelectRecentText: (memory: TextMemory) => void;
  onStartTextExtract?: () => void;
  textExtractActive?: boolean;
  imageReady?: boolean;
  recognizedText?: string;
  isRecognizing?: boolean;
  onClearRecognizedText?: () => void;
}

function truncate(text: string, max = 16): string {
  if (!text) return "Empty";
  const line = text.split("\n")[0] ?? "";
  return line.length <= max ? line || "Empty" : line.slice(0, max) + "…";
}

export function TextSettings({
  settings,
  onChange,
  recentTexts,
  onSelectRecentText,
  onStartTextExtract,
  textExtractActive = false,
  imageReady = true,
  recognizedText = "",
  isRecognizing = false,
  onClearRecognizedText,
}: TextSettingsProps) {
  const [mode, setMode] = useState<TextMode>("text");

  return (
    <div className="space-y-5">
      <TabGroup
        tabs={[
          { id: "text", label: "Text" },
          { id: "extract", label: "Text Extract" },
        ]}
        active={mode}
        onChange={(id) => setMode(id as TextMode)}
      />

      <AnimatePresence mode="wait">
        {mode === "text" && (
          <motion.div
            key="text"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: quickSpring }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            className="space-y-5"
          >
            {/* Font Size */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                  Font Size
                </label>
                <span className="text-xs text-theme-foreground tabular-nums">
                  {settings.fontSize}px
                </span>
              </div>
              <div className="flex items-center justify-between">
                {FONT_SIZE_PRESETS.map((size) => {
                  const active = settings.fontSize === size;
                  return (
                    <button
                      key={size}
                      onClick={() => onChange({ ...settings, fontSize: size })}
                      className={[
                        "flex items-center justify-center w-10 h-10 rounded-full transition-all text-xs font-mono",
                        active
                          ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                          : "hover:bg-theme-accent",
                      ].join(" ")}
                      aria-label={`Font size ${size}`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              <div className="relative h-2 w-full rounded-full bg-theme-muted">
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                  style={{
                    width: `${((settings.fontSize - 8) / (120 - 8)) * 100}%`,
                  }}
                />
                <input
                  type="range"
                  min={8}
                  max={120}
                  step={1}
                  value={settings.fontSize}
                  onChange={(e) =>
                    onChange({ ...settings, fontSize: Number(e.target.value) })
                  }
                  className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
                />
              </div>
            </div>

            {/* Font Weight */}
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Font Weight
              </label>
              <TabGroup
                tabs={[
                  { id: "normal", label: "Normal" },
                  { id: "bold", label: "Bold" },
                ]}
                active={settings.fontWeight ?? "normal"}
                onChange={(id) =>
                  onChange({ ...settings, fontWeight: id as "normal" | "bold" })
                }
              />
            </div>

            {/* Color */}
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Color
              </label>
              <div className="flex flex-wrap gap-2 py-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onChange({ ...settings, textColor: color })}
                    className={[
                      "w-7 h-7 rounded-full border-2 transition-all",
                      settings.textColor === color
                        ? "border-accent scale-110 ring-2 ring-accent/30"
                        : "border-transparent hover:scale-105",
                    ].join(" ")}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Recent Texts */}
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Recent Texts
              </label>
              {recentTexts.length === 0 ? (
                <div className="flex justify-center gap-2 px-3 py-4 rounded-lg text-xs large-badge-item type-current">
                  <span className="large-badge">Add Text to See Text History</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTexts.slice(0, 6).map((memory) => (
                    <button
                      key={memory.id}
                      onClick={() => onSelectRecentText(memory)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/20 text-text-primary hover:ring-2 hover:ring-accent/50 transition-all min-w-0"
                      title="Click to reopen this text for editing"
                    >
                      <Type className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {truncate(memory.text)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {mode === "extract" && (
          <motion.div
            key="extract"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: quickSpring }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            className="space-y-4"
          >
            <p className="text-[10px] text-theme-muted-foreground leading-relaxed">
              Drag a region on the image to OCR text from it. The recognized
              text will appear below.
            </p>
            {onStartTextExtract && (
              <Button
                onClick={onStartTextExtract}
                disabled={!imageReady || isRecognizing}
                className={`w-full gap-2 ${
                  textExtractActive
                    ? "bg-accent text-text-primary ring-2 ring-accent/50"
                    : ""
                }`}
              >
                <Crop className="h-4 w-4" />
                {isRecognizing
                  ? "Recognizing…"
                  : textExtractActive
                    ? "Drag region on image…"
                    : "Start OCR"}
              </Button>
            )}

            {isRecognizing && (
              <div className="flex items-center justify-center py-4">
                <div className="canvas-spinner" />
              </div>
            )}

            {recognizedText && !isRecognizing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                    Result
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => navigator.clipboard.writeText(recognizedText)}
                      className="text-[10px] px-2 py-0.5 rounded bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-border-active transition-all"
                    >
                      Copy
                    </button>
                    {onClearRecognizedText && (
                      <button
                        onClick={onClearRecognizedText}
                        className="text-[10px] px-2 py-0.5 rounded bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-border-active transition-all"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-bg-elevated border border-border text-sm text-text-primary font-mono leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto scrollbar-thin">
                  {recognizedText}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
