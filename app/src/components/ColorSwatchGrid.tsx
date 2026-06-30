import { useEffect, useRef, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { useUserColors } from "@/hooks/useUserColors";
import { parseColor, warmColorParser } from "@/lib/colorParser";

interface Props {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
  label?: string;
  /**
   * Set to false to hide the "+" custom-color button and the user-added
   * swatches. Defaults to true so all pickers share the global user palette.
   */
  allowCustom?: boolean;
}

export function ColorSwatchGrid({
  colors,
  value,
  onChange,
  label = "Color",
  allowCustom = true,
}: Props) {
  const { userColors, addColor, removeColor } = useUserColors();
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const [previewBg, setPreviewBg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Warm the Rust parser once any picker mounts so the first + click is snappy.
  useEffect(() => {
    warmColorParser();
  }, []);

  useEffect(() => {
    if (adding) {
      inputRef.current?.focus();
      setInput("");
      setPreviewBg(null);
      setError(null);
    }
  }, [adding]);

  // Live preview as the user types — runs through the Rust parser.
  useEffect(() => {
    if (!adding) return;
    let cancelled = false;
    if (!input.trim()) {
      setPreviewBg(null);
      setError(null);
      return;
    }
    void parseColor(input).then((parsed) => {
      if (cancelled) return;
      if (parsed) {
        setPreviewBg(parsed.css);
        setError(null);
      } else {
        setPreviewBg(null);
        setError("Not a valid color");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [input, adding]);

  const handleSubmit = async () => {
    const parsed = await parseColor(input);
    if (!parsed) {
      setError("Not a valid color");
      return;
    }
    addColor(parsed.hex);
    onChange(parsed.hex);
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-2xs text-theme-muted-foreground">{label}</label>
      <div className="flex flex-wrap gap-2 py-1">
        {colors.map((color) => (
          <Swatch
            key={color}
            color={color}
            active={value === color}
            onClick={() => onChange(color)}
          />
        ))}
        {allowCustom &&
          userColors.map((color) => (
            <Swatch
              key={`user:${color}`}
              color={color}
              active={value === color}
              onClick={() => onChange(color)}
              onRemove={() => removeColor(color)}
            />
          ))}
        {allowCustom && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            aria-label="Add custom color"
            className={[
              "flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all",
              adding
                ? "border-theme-primary bg-theme-primary/15 text-theme-primary"
                : "border-dashed border-theme-border bg-theme-muted/20 text-theme-muted-foreground hover:text-theme-foreground hover:border-theme-foreground/50",
            ].join(" ")}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {allowCustom && adding && (
        <div className="space-y-1.5 rounded-md border border-theme-sidebar-border bg-theme-muted/20 p-2">
          <div className="flex items-center gap-2">
            <span
              className="h-7 w-7 shrink-0 rounded-full border border-theme-border"
              style={{
                backgroundColor: previewBg ?? "transparent",
                backgroundImage: previewBg
                  ? undefined
                  : "linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%)",
                backgroundSize: previewBg ? undefined : "8px 8px",
              }}
            />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setAdding(false);
                }
              }}
              placeholder="#ff5a3c or rgba(255,90,60,1)"
              className="flex-1 min-w-0 rounded-md border border-theme-border bg-theme-background/40 px-2 py-1 text-2xs text-theme-foreground placeholder:text-theme-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-theme-primary"
            />
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!previewBg}
              className="flex items-center justify-center w-7 h-7 rounded-md bg-theme-primary text-theme-primary-foreground hover:bg-theme-primary/90 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Add color"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
          {error && (
            <p className="text-2xs text-destructive pl-1">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

interface SwatchProps {
  color: string;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
}

function Swatch({ color, active, onClick, onRemove }: SwatchProps) {
  // The "transparent" entry is the transparent backing canvas: render the same
  // transparency checkerboard the canvas itself shows (`.checkerboard-canvas`,
  // styles.css — also used by CanvasArea) instead of a flat panel-coloured
  // square, so the swatch reads as "no fill / checkerboard". Solid colours keep
  // their flat fill.
  const isTransparent = color === "transparent";
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        onClick={onClick}
        className={[
          "w-7 h-7 rounded-full border-2 border-transparent transition-all overflow-hidden",
          isTransparent && "checkerboard-canvas",
          active
            ? "scale-110 ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
            : "hover:scale-105",
        ]
          .filter(Boolean)
          .join(" ")}
        style={isTransparent ? undefined : { backgroundColor: color }}
        aria-label={isTransparent ? "Transparent (checkerboard)" : `Color ${color}`}
      />
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded-full bg-theme-sidebar text-theme-muted-foreground border border-theme-border hover:text-theme-foreground"
          aria-label={`Remove ${color}`}
        >
          <X className="h-2 w-2" />
        </button>
      )}
    </span>
  );
}
