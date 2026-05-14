import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crop, Type, ChevronDown } from "lucide-react";
import type { ToolSettings } from "@/lib/types";
import { TEXT_COLORS } from "@/lib/colors";
import { TabGroup } from "@/components/TabGroup";
import { SizeSlider } from "@/components/SizeSlider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { Button } from "@/components/ui/button";
import { quickSpring } from "@/lib/animations";

const FONT_FAMILIES = [
  { label: "Sans Serif", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Monospace", value: "monospace" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Comic Sans", value: "Comic Sans MS, cursive" },
  { label: "Trebuchet", value: "Trebuchet MS, sans-serif" },
  { label: "Palatino", value: "Palatino, serif" },
] as const;

const FONT_SIZE_PRESETS = [16, 32, 48, 72] as const;

export interface TextMemory {
  id: number;
  text: string;
  fontSize: number;
  fontFamily: string;
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
            <SizeSlider
              label="Font Size"
              value={settings.fontSize}
              min={8}
              max={120}
              onChange={(v) => onChange({ ...settings, fontSize: v })}
              presets={FONT_SIZE_PRESETS}
              variant="numbers"
            />

            {/* Font Family */}
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Font Family
              </label>
              <div className="relative">
                <select
                  value={settings.fontFamily ?? "sans-serif"}
                  onChange={(e) => onChange({ ...settings, fontFamily: e.target.value })}
                  className="w-full appearance-none rounded-lg bg-theme-muted px-3 py-2 pr-8 text-sm text-theme-foreground border border-transparent focus:outline-none focus:border-theme-ring cursor-pointer"
                  style={{ fontFamily: settings.fontFamily ?? "sans-serif" }}
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-muted-foreground" />
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
            <ColorSwatchGrid
              colors={TEXT_COLORS}
              value={settings.textColor}
              onChange={(color) => onChange({ ...settings, textColor: color })}
            />

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
