// Paste SVG: step 2 of the New menu, beside New Canvas and Create AI Image.
// Paste SVG code (the text, not a file), pick the canvas size and background,
// and Create Canvas makes an image from it.
//
// The code becomes an `.svg` File and takes the same import a dropped `.svg`
// takes (lib/pastedSvg → onCreate → handleAddPhotos → lib/rasterizeSvg). So
// it is rasterized at the import boundary through an `<img>`, where scripts do
// not run, and it can still go back out as an SVG (SVG → SVG export). The only
// difference from a dropped file is the size: you chose it, so the rasterizer
// is told to use it exactly (markExactSvgSize).
import { useCallback, useId, useMemo, useRef, useState, useEffect } from "react";
import { PaneHeader } from "@/components/ui/dialog-pane";
import { PanelAction, PanelActionBar } from "@/components/ui/panel-action-bar";
import { FieldLabel } from "@/components/ui/field-label";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { TEXT_COLORS, TRANSPARENT, isTransparent } from "@/lib/colors";
import { parseColor } from "@/lib/colorParser";
import { FIELD_TEXTAREA } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { markExactSvgSize } from "@/lib/rasterizeSvg";
import {
  PASTED_SVG_MAX_SIDE,
  buildPastedSvg,
  otherSide,
  readPastedSvg,
} from "@/lib/pastedSvg";

interface Props {
  onBack: () => void;
  /** In the New dialog the header carries the [X]; the start page has none. */
  closable: boolean;
  /** Code already in hand — the Paste tile found SVG text on the clipboard. */
  initialText?: string;
  onCreate: (file: File) => void;
}

export function PasteSvgPanel({ onBack, closable, initialText = "", onCreate }: Props) {
  const [text, setText] = useState(initialText);
  const parsed = useMemo(() => readPastedSvg(text), [text]);
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  // Transparent by default: an SVG is usually a drawing on nothing, and a
  // white box behind a logo is the thing you would then have to remove.
  const [transparent, setTransparent] = useState(true);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const switchId = useId();

  // A new drawing (a different shape) starts at its own suggested size. Typing
  // inside the same drawing leaves a size you already set alone.
  const shapeKey = parsed.kind === "ok" ? `${parsed.aspect}:${parsed.suggested.w}` : "";
  useEffect(() => {
    if (parsed.kind !== "ok") return;
    setW(String(parsed.suggested.w));
    setH(String(parsed.suggested.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the shape on purpose
  }, [shapeKey]);

  // Focus the code field once the step opens — unless you're already typing
  // somewhere. The timer can fire late on a busy machine, and an unguarded
  // focus() then pulled the caret out of the width box mid-word: "512" landed
  // at the end of the SVG code and the size stayed 1024 (CI, PR #509; repro:
  // e2e/paste-svg.spec.ts "a late autofocus").
  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (!typing) areaRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, []);

  const ok = parsed.kind === "ok";
  const aspect = ok ? parsed.aspect : 1;
  const wNum = parseInt(w, 10);
  const hNum = parseInt(h, 10);
  const sizeOk =
    wNum >= 1 && hNum >= 1 && wNum <= PASTED_SVG_MAX_SIDE && hNum <= PASTED_SVG_MAX_SIDE;

  const typeSide = (value: string, typed: "w" | "h") => {
    const n = parseInt(value, 10);
    if (typed === "w") setW(value);
    else setH(value);
    if (!(n >= 1)) return;
    const other = String(otherSide(aspect, n, typed));
    if (typed === "w") setH(other);
    else setW(other);
  };

  const create = useCallback(async () => {
    if (parsed.kind !== "ok" || !sizeOk || busy) return;
    setBusy(true);
    try {
      const bg = transparent ? null : await parseColor(bgColor);
      const svg = buildPastedSvg(parsed, wNum, hNum, bg ? { r: bg.r, g: bg.g, b: bg.b } : null);
      onCreate(
        markExactSvgSize(new File([svg], "pasted.svg", { type: "image/svg+xml" })),
      );
    } finally {
      setBusy(false);
    }
  }, [parsed, sizeOk, busy, transparent, bgColor, wNum, hNum, onCreate]);

  const status =
    parsed.kind === "invalid"
      ? parsed.message
      : parsed.kind === "ok"
        ? parsed.frame
          ? `Drawn at ${Math.round(parsed.frame.w)} × ${Math.round(parsed.frame.h)}. It keeps that shape at any size.`
          : "This code gives no size, so it starts square."
        : "Paste the code of an SVG: everything from <svg to </svg>.";

  return (
    <>
      <PaneHeader title="Paste SVG" onBack={onBack} closable={closable} />

      <div className="space-y-2">
        <FieldLabel
          title="SVG code"
          info="The text of an SVG file, or an icon's code copied from a web page. It is turned into pixels the same way a dropped .svg file is."
        />
        <textarea
          ref={areaRef}
          aria-label="SVG code"
          aria-describedby={`${switchId}-status`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">…</svg>'}
          className={cn(FIELD_TEXTAREA, "min-h-[12rem] font-mono text-xs")}
        />
        <p
          id={`${switchId}-status`}
          aria-live="polite"
          className={cn(
            "text-2xs leading-relaxed",
            parsed.kind === "invalid" ? "text-destructive" : "text-theme-muted-foreground",
          )}
        >
          {status}
        </p>
      </div>

      <div className={ok ? "" : "pointer-events-none opacity-40"}>
        <div className="flex items-end gap-2">
          <NumberField
            label="width"
            min={1}
            max={PASTED_SVG_MAX_SIDE}
            value={w}
            disabled={!ok}
            onChange={(e) => typeSide(e.target.value, "w")}
          />
          <span className="pb-2 text-text-muted">×</span>
          <NumberField
            label="height"
            min={1}
            max={PASTED_SVG_MAX_SIDE}
            value={h}
            disabled={!ok}
            onChange={(e) => typeSide(e.target.value, "h")}
          />
        </div>
      </div>

      {/* The checkerboard swatch and the Transparent switch below are one
          state: either one turns the other on. */}
      <ColorSwatchGrid
        colors={TEXT_COLORS}
        value={transparent ? TRANSPARENT : bgColor}
        onChange={(c) => {
          setTransparent(isTransparent(c));
          if (!isTransparent(c)) setBgColor(c);
        }}
        label="Background"
      />

      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={switchId}
          className="flex cursor-pointer items-center gap-2 text-xs text-theme-muted-foreground"
        >
          <span
            className="h-3.5 w-3.5 rounded-sm border border-border"
            style={{
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.3) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.3) 75%, transparent 75%)",
              backgroundSize: "6px 6px",
            }}
          />
          Transparent background
        </label>
        <Switch id={switchId} checked={transparent} onCheckedChange={setTransparent} />
      </div>

      <PanelActionBar
        reason={!ok ? "Paste SVG code first." : !sizeOk ? `Width and height go from 1 to ${PASTED_SVG_MAX_SIDE}.` : undefined}
      >
        <PanelAction onClick={create} disabled={!ok || !sizeOk || busy}>
          Create Canvas
        </PanelAction>
      </PanelActionBar>
    </>
  );
}
