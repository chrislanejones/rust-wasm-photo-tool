import { useState } from "react";
import {
  FlipHorizontal,
  FlipVertical,
  RotateCw,
} from "lucide-react";
import { ToolButton } from "@/components/ui/tool-button";
import { SizeSlider } from "@/components/SizeSlider";

interface Props {
  disabled: boolean;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90Cw: () => void;
  onBrightness: (delta: number) => void;
  onContrast: (factor: number) => void;
}

export function TransformSettings({
  disabled,
  onFlipH,
  onFlipV,
  onRotate90Cw,
  onBrightness,
  onContrast,
}: Props) {
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(100);

  const commitBrightness = () => {
    if (brightness !== 0) {
      onBrightness(brightness / 100);
      setBrightness(0);
    }
  };

  const commitContrast = () => {
    if (contrast !== 100) {
      onContrast(contrast / 100);
      setContrast(100);
    }
  };

  return (
    <div className="space-y-5">
      <span className="text-[11px] text-theme-muted-foreground">Transform</span>

      {/* Geometry buttons */}
      <div className="grid grid-cols-3 gap-2">
        <ToolButton onClick={onFlipH} disabled={disabled} title="Flip horizontal">
          <FlipHorizontal />
        </ToolButton>
        <ToolButton onClick={onFlipV} disabled={disabled} title="Flip vertical">
          <FlipVertical />
        </ToolButton>
        <ToolButton onClick={onRotate90Cw} disabled={disabled} title="Rotate 90° CW">
          <RotateCw />
        </ToolButton>
      </div>

      <SizeSlider
        label="Brightness"
        value={brightness}
        onChange={setBrightness}
        onCommit={() => commitBrightness()}
        min={-100}
        max={100}
        disabled={disabled}
        valueDisplay={brightness > 0 ? `+${brightness}` : String(brightness)}
      />

      <SizeSlider
        label="Contrast"
        value={contrast}
        onChange={setContrast}
        onCommit={() => commitContrast()}
        min={0}
        max={300}
        unit="%"
        disabled={disabled}
      />
    </div>
  );
}
