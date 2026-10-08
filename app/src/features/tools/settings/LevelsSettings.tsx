// Enhance › Levels — black point, white point and midtones, with the photo
// updating as you drag.
//
// The engine does the work (src/levels.rs): opening this panel starts a preview
// on a copy of the layer, every slider move recomputes from that copy, Apply
// commits ONE undo step (recorded as `Op::Levels`), and leaving the panel
// without applying cancels the preview and puts the photo back. This file only
// holds three numbers; the histogram is the sidebar's footer (HistogramFooter).
import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { SizeSlider } from "@/components/ui/size-slider";
import {
  PanelAction,
  PanelActionBar,
} from "@/components/ui/panel-action-bar";
import type { LevelsControls } from "@/hooks/useTransforms";
import { ToolPanel } from "@/components/ui/tool-panel";

/** The identity. Gamma is held ×100 so the slider stays integer. */
const BLACK = 0;
const WHITE = 255;
const GAMMA = 100;

interface LevelsSettingsProps {
  levels?: LevelsControls;
  imageReady: boolean;
}

export function LevelsSettings({ levels, imageReady }: LevelsSettingsProps) {
  const [black, setBlack] = useState(BLACK);
  const [white, setWhite] = useState(WHITE);
  const [gamma, setGamma] = useState(GAMMA);

  // One preview for as long as the panel is open on an image. The cleanup
  // cancels it, which is what makes "leave without applying" put the photo
  // back. `levels` has a stable identity (useTransforms), so this does not
  // re-run in the middle of a drag.
  useEffect(() => {
    if (!levels || !imageReady) return;
    let alive = true;
    void (async () => {
      await levels.begin();
      if (!alive) await levels.cancel();
    })();
    return () => {
      alive = false;
      void levels.cancel();
    };
  }, [levels, imageReady]);

  const isIdentity = black === BLACK && white === WHITE && gamma === GAMMA;

  const move = (b: number, w: number, g: number) => {
    levels?.preview(b, w, g / 100);
  };
  // Black stays below white and white above black, so the curve never folds.
  const onBlack = (v: number) => {
    const b = Math.min(v, white - 1);
    setBlack(b);
    move(b, white, gamma);
  };
  const onWhite = (v: number) => {
    const w = Math.max(v, black + 1);
    setWhite(w);
    move(black, w, gamma);
  };
  const onGamma = (v: number) => {
    setGamma(v);
    move(black, white, v);
  };
  const reset = () => {
    setBlack(BLACK);
    setWhite(WHITE);
    setGamma(GAMMA);
    move(BLACK, WHITE, GAMMA);
  };
  const apply = async () => {
    if (!levels || isIdentity) return;
    await levels.apply(black, white, gamma / 100);
    setBlack(BLACK);
    setWhite(WHITE);
    setGamma(GAMMA);
    // Keep working: a fresh preview on the new pixels. The histogram is the
    // sidebar's footer (HistogramFooter), which follows every edit itself.
    await levels.begin();
  };

  return (
    <ToolPanel>
      <SectionHeader
        title="Levels"
        info="Drag Black point and White point in to set the darkest and brightest tones, and Midtones to lift or deepen everything between. The photo updates as you drag. Apply makes it one undo step; leave the panel without applying and the photo goes back."
      />

      {/* The Curve chart is gone (10-08): the histogram is the sidebar's
          footer on Adjustments, Levels and Presets, so this panel no longer
          reads one of its own. The edited dot moved to Black point — one
          dot for the three points together, its Reset resets all three. */}
      <SizeSlider
        edited={{ isEdited: !isIdentity, onReset: reset, disabled: !imageReady }}
        label="Black point"
        labelInfo="Everything this dark or darker becomes black."
        value={black}
        onChange={onBlack}
        min={0}
        max={254}
        disabled={!imageReady}
        valueDisplay={String(black)}
      />
      <SizeSlider
        label="Midtones"
        labelInfo="Above 1.00 lifts the tones between black and white; below 1.00 deepens them."
        value={gamma}
        onChange={onGamma}
        min={10}
        max={500}
        disabled={!imageReady}
        valueDisplay={(gamma / 100).toFixed(2)}
      />
      <SizeSlider
        label="White point"
        labelInfo="Everything this bright or brighter becomes white."
        value={white}
        onChange={onWhite}
        min={1}
        max={255}
        disabled={!imageReady}
        valueDisplay={String(white)}
      />

      {/* Restore on the left, commit on the right, each only as wide as its own
          label — the shared two-up panel footer. */}
      <PanelActionBar layout="split">
        <PanelAction onClick={reset} disabled={!imageReady || isIdentity}>
          Reset
        </PanelAction>
        <PanelAction
          onClick={() => void apply()}
          disabled={!imageReady || isIdentity}
        >
          Apply
        </PanelAction>
      </PanelActionBar>
    </ToolPanel>
  );
}
