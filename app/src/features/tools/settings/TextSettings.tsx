import { useState } from "react";
import { Type, Pencil } from "lucide-react";
import type { ToolSettings } from "@/lib/types";

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
  // FIX #7: Click-to-edit state for recent texts
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const slots = [...recentTexts.slice(0, 3)];
  while (slots.length < 3) slots.push(null as unknown as TextMemory);

  const handleStartEdit = (memory: TextMemory) => {
    setEditingId(memory.id);
    setEditText(memory.text);
  };

  const handleCommitEdit = (memory: TextMemory) => {
    if (editText.trim()) {
      onSelectRecentText({ ...memory, text: editText });
    }
    setEditingId(null);
    setEditText("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

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
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
          Font Weight
        </label>
        <div className="flex gap-2 py-2">
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

      {/* Color */}
      <div className="space-y-2.5">
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

      {/* FIX #7: Recent Texts with click-to-edit */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
          Recent Texts
        </label>
        <div className="space-y-2">
          {slots.map((memory, i) => {
            const isEditing = memory && editingId === memory.id;

            // Inline edit mode
            if (isEditing && memory) {
              return (
                <div
                  key={memory.id}
                  className="flex flex-col gap-1.5 px-3 py-2 rounded-lg bg-bg-tertiary border border-accent"
                >
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleCommitEdit(memory);
                      }
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    autoFocus
                    rows={2}
                    className="w-full bg-bg-primary text-text-primary text-sm rounded-md px-2 py-1.5 outline-none border border-border focus:border-accent resize-none"
                    placeholder="Edit text…"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleCommitEdit(memory)}
                      className="flex-1 text-xs py-1 rounded-md bg-accent text-text-primary font-medium transition-all"
                    >
                      Apply
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex-1 text-xs py-1 rounded-md bg-bg-elevated text-text-muted font-medium transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            // Normal display — click to apply, pencil to edit
            return (
              <div
                key={memory?.id ?? `empty-${i}`}
                className={[
                  "w-full flex items-center rounded-lg transition-all",
                  memory
                    ? "bg-accent/20 text-text-primary hover:ring-2 hover:ring-accent/50 cursor-pointer"
                    : "bg-bg-elevated text-text-muted cursor-not-allowed opacity-50",
                ].join(" ")}
              >
                <button
                  onClick={() => memory && onSelectRecentText(memory)}
                  disabled={!memory}
                  className="flex-1 flex items-center gap-2 px-3 py-2 min-w-0"
                >
                  <Type className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {memory ? truncate(memory.text) : "Empty slot"}
                  </span>
                </button>
                {memory && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(memory);
                    }}
                    className="shrink-0 p-2 rounded-r-lg hover:bg-bg-elevated/50 transition-colors"
                    title="Edit text before applying"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
