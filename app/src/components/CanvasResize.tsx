import { useCallback, useEffect, useState } from "react";
import { Scaling } from "lucide-react";
import { LargeButton } from "@/components/ui/large-button";
import { DimensionFields } from "@/components/DimensionFields";

interface Props {
  /** Current canvas (image) dimensions. */
  width: number;
  height: number;
  disabled?: boolean;
  /** Apply the canvas-size change — runs in Rust (`resize_canvas`), which
   *  re-lays the photo at its native resolution (NO resample). */
  onApply: (w: number, h: number) => void;
}

/**
 * Canvas-size control for Layer Settings — reuses the Resize tool's shared
 * {@link DimensionFields} (Scale %, W×H, aspect lock) so it matches that panel
 * exactly, plus an Apply button. This is a Photoshop-style **Canvas Size**
 * change (the backing document grows/shrinks, the photo stays at its native
 * resolution, centred, and the new area fills with the backing color) — it does
 * NOT resample the image. The work runs in Rust (`resize_canvas`); this only
 * collects the target dimensions.
 */
export function CanvasResize({ width, height, disabled, onApply }: Props) {
  const [w, setW] = useState(String(width));
  const [h, setH] = useState(String(height));
  const [lockAspect, setLockAspect] = useState(true);

  // Reset the fields whenever the source dims change (new image / after apply).
  useEffect(() => {
    setW(String(width));
    setH(String(height));
  }, [width, height]);

  const widthPercent =
    width > 0 && parseInt(w, 10) > 0
      ? Math.round((parseInt(w, 10) / width) * 100)
      : 100;

  const onWidthChange = useCallback(
    (val: string) => {
      setW(val);
      const nw = parseInt(val, 10);
      if (!isNaN(nw) && nw > 0 && lockAspect && width > 0) {
        setH(String(Math.round((nw / width) * height)));
      }
    },
    [lockAspect, width, height],
  );
  const onHeightChange = useCallback(
    (val: string) => {
      setH(val);
      const nh = parseInt(val, 10);
      if (!isNaN(nh) && nh > 0 && lockAspect && height > 0) {
        setW(String(Math.round((nh / height) * width)));
      }
    },
    [lockAspect, width, height],
  );
  const onPercentChange = useCallback(
    (pct: number) => {
      setW(String(Math.max(1, Math.round((width * pct) / 100))));
      setH(String(Math.max(1, Math.round((height * pct) / 100))));
    },
    [width, height],
  );

  const targetW = parseInt(w, 10);
  const targetH = parseInt(h, 10);
  const changed =
    targetW > 0 &&
    targetH > 0 &&
    (targetW !== width || targetH !== height);

  return (
    <div className="space-y-3">
      <DimensionFields
        width={w}
        height={h}
        widthPercent={widthPercent}
        lockAspect={lockAspect}
        disabled={disabled}
        onWidthChange={onWidthChange}
        onHeightChange={onHeightChange}
        onPercentChange={onPercentChange}
        onToggleLock={() => setLockAspect((v) => !v)}
      />

      <LargeButton
        className="w-full"
        disabled={disabled || !changed}
        onClick={() => onApply(targetW, targetH)}
      >
        <Scaling className="h-4 w-4" /> Resize canvas
        {changed ? ` → ${targetW}×${targetH}` : ""}
      </LargeButton>
    </div>
  );
}
