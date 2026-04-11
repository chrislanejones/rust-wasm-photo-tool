import { Type } from "lucide-react";
import type { ToolSettings } from "@/lib/types";
import { TabGroup } from "@/components/TabGroup";

const FONT_SIZE_PRESETS = [16, 32, 48, 72] as const;

const COLORS = [
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#000000",
] as const;

export interface TextMemory {
  id: number;
  text: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  textColor: string;
}

interface TextSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
  recentTexts: TextMemory[];
  onSelectRecentText: (memory: TextMemory) => void;
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
}: TextSettingsProps) {
  return (
    <div className="space-y-8">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
        Text Tool
      </h3>

      <p className="text-[10px] text-theme-muted-foreground leading-relaxed">
        Click anywhere on the image to place text. Press{" "}
        <kbd className="px-1 py-0.5 rounded bg-bg-elevated border border-border text-[9px]">
          Enter
        </kbd>{" "}
        to commit,{" "}
        <kbd className="px-1 py-0.5 rounded bg-bg-elevated border border-border text-[9px]">
          Shift+Enter
        </kbd>{" "}
        for newline,{" "}
        <kbd className="px-1 py-0.5 rounded bg-bg-elevated border border-border text-[9px]">
          Esc
        </kbd>{" "}
        to cancel.
      </p>

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

      {/* Recent Texts — click to re-open the last text box with that text */}
      {recentTexts.length > 0 && (
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
            Recent Texts
          </label>
          <div className="space-y-2">
            {recentTexts.slice(0, 8).map((memory) => (
              <button
                key={memory.id}
                onClick={() => onSelectRecentText(memory)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/20 text-text-primary hover:ring-2 hover:ring-accent/50 transition-all min-w-0"
              >
                <Type className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium truncate">
                  {truncate(memory.text)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
