// ===== FILE: app/src/features/tools/settings/TextSettings.tsx =====
import { useState, useCallback, useEffect, useRef } from "react";
import { Type } from "lucide-react";
import type { ToolSettings } from "@/lib/types";

const FONT_SIZE_PRESETS = [16, 32, 48, 72] as const;

const COLORS = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
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
  const slots = [...recentTexts.slice(0, 3)];
  while (slots.length < 3) slots.push(null as unknown as TextMemory);

  return (
    <div className="space-y-5">
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
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
            Font Size
          </label>
          <span className="text-xs text-theme-foreground tabular-nums">
            {settings.fontSize}px
          </span>
        </div>
        <div className="flex items-center justify-between">
          {FONT_SIZE_PRESETS.map((size) => (
            <button
              key={size}
              onClick={() => onChange({ ...settings, fontSize: size })}
              className={[
                "flex items-center justify-center w-10 h-10 rounded-lg text-xs font-medium transition-all",
                settings.fontSize === size
                  ? "bg-accent text-text-primary ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                  : "bg-bg-elevated hover:bg-bg-tertiary",
              ].join(" ")}
            >
              {size}
            </button>
          ))}
        </div>
        <div className="relative h-2 w-full rounded-full bg-theme-muted">
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
            style={{ width: `${((settings.fontSize - 8) / 64) * 100}%` }}
          />
          <input
            type="range"
            min={8}
            max={72}
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
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
          Font Weight
        </label>
        <div className="flex gap-2">
          {(["normal", "bold"] as const).map((w) => (
            <button
              key={w}
              onClick={() => onChange({ ...settings, fontWeight: w })}
              className={[
                "flex-1 py-2 px-3 rounded-lg text-sm transition-all",
                settings.fontWeight === w
                  ? "bg-accent text-text-primary ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                  : "bg-bg-elevated hover:bg-bg-tertiary",
                w === "bold" ? "font-bold" : "",
              ].join(" ")}
            >
              {w === "normal" ? "Normal" : "Bold"}
            </button>
          ))}
        </div>
      </div>

      {/* Text Color */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
          Text Color
        </label>
        <div className="grid grid-cols-5 gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onChange({ ...settings, textColor: color })}
              className={[
                "w-8 h-8 rounded-lg transition-transform hover:scale-110",
                settings.textColor === color
                  ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                  : "",
              ].join(" ")}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Recent Texts */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
          Recent Texts
        </label>
        <div className="space-y-2">
          {slots.map((memory, i) => (
            <button
              key={memory?.id ?? `empty-${i}`}
              onClick={() => memory && onSelectRecentText(memory)}
              disabled={!memory}
              className={[
                "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all",
                memory
                  ? "bg-accent/20 text-text-primary hover:ring-2 hover:ring-accent/50"
                  : "bg-bg-elevated text-text-muted cursor-not-allowed opacity-50",
              ].join(" ")}
            >
              <Type className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium truncate">
                {memory ? truncate(memory.text) : "Empty slot"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
