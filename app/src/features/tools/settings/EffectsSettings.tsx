// Enhance › Adjustments — a preview SESSION over an untouched copy (10-08),
// the same shape as Levels.
//
// It used to bake a DELTA into the layer on every slider release. Measured on
// a four-band test image (40/120/200/240): brightness +65 gave 206/255/255/255
// — the scale was ±255 per unit — and ↺ applied −65 to pixels already clipped,
// leaving 40/89/89/89 that only Undo could repair. Nothing moved while you
// dragged, and four of the seven sliders snapped back to 0 after applying, so
// their ↺ had nothing to reset.
//
// Now: opening the panel starts a preview (src/adjust.rs), every move
// recomputes all seven from the copy, each ↺ puts exactly that slider back,
// Apply is ONE undo step, and leaving the panel for another tool applies what
// is set, and a photo switch applies it to the outgoing photo before the
// switch saves it (lib/pendingEdits).
import { useEffect, useRef, useState } from "react";
import { SizeSlider } from "@/components/ui/size-slider";
import { SectionHeader } from "@/components/ui/section-header";
import { ToolPanel } from "@/components/ui/tool-panel";
import { PanelAction, PanelActionBar } from "@/components/ui/panel-action-bar";
import { ADJUST_DEFAULTS, type AdjustControls, type AdjustValues } from "@/hooks/useTransforms";
import { registerPendingCommit } from "@/lib/pendingEdits";

interface EffectsSettingsProps {
  adjust?: AdjustControls;
  imageReady: boolean;
  activePhotoId?: string | null;
}

type Key = keyof AdjustValues;

const isIdentity = (v: AdjustValues) =>
  (Object.keys(ADJUST_DEFAULTS) as Key[]).every((k) => v[k] === ADJUST_DEFAULTS[k]);

const SLIDERS: { key: Key; label: string; info: string; min: number; max: number; unit?: string }[] = [
  { key: "brightness", label: "Brightness", info: "Lighter or darker, evenly across every tone.", min: -100, max: 100 },
  { key: "contrast", label: "Contrast", info: "100 is the photo as it is. Higher pulls darks and lights apart.", min: 10, max: 300 },
  { key: "saturation", label: "Saturation", info: "100 is the photo as it is. 0 is black and white.", min: 0, max: 300 },
  { key: "shadows", label: "Shadows", info: "Lifts or deepens the dark tones only.", min: -100, max: 100 },
  { key: "highlights", label: "Highlights", info: "Recovers or brightens the light tones only.", min: -100, max: 100 },
  { key: "blur", label: "Blur", info: "Softens the whole photo.", min: 0, max: 100, unit: "%" },
  { key: "sharpen", label: "Sharpen", info: "Crisps up edges across the whole photo.", min: 0, max: 100, unit: "%" },
];

export function EffectsSettings({ adjust, imageReady, activePhotoId }: EffectsSettingsProps) {
  const [values, setValues] = useState<AdjustValues>(ADJUST_DEFAULTS);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // Leaving the panel for another tool APPLIES what is set (declared first,
  // so on unmount its cleanup runs before the session's cancel below).
  useEffect(
    () => () => {
      if (adjust && !isIdentity(valuesRef.current)) void adjust.apply(valuesRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
    [],
  );

  // A photo switch bakes what is set onto the OUTGOING photo before it saves
  // it (lib/pendingEdits). Resetting the ref first means the session cleanup
  // and the unmount apply below both see the identity and do nothing more.
  useEffect(() => {
    if (!adjust) return;
    return registerPendingCommit(async () => {
      const v = valuesRef.current;
      if (isIdentity(v)) return;
      valuesRef.current = ADJUST_DEFAULTS;
      setValues(ADJUST_DEFAULTS);
      await adjust.apply(v);
    });
  }, [adjust]);

  // One preview per photo for as long as the panel is open on an image.
  useEffect(() => {
    if (!adjust || !imageReady) return;
    void adjust.begin();
    return () => {
      void adjust.cancel();
      setValues(ADJUST_DEFAULTS);
    };
  }, [adjust, imageReady, activePhotoId]);

  const set = (key: Key, v: number) => {
    const next = { ...valuesRef.current, [key]: v };
    setValues(next);
    adjust?.preview(next);
  };

  const resetAll = () => {
    setValues(ADJUST_DEFAULTS);
    adjust?.preview(ADJUST_DEFAULTS);
  };

  const apply = async () => {
    if (!adjust || isIdentity(values)) return;
    const v = values;
    setValues(ADJUST_DEFAULTS);
    await adjust.apply(v);
    // Keep working: a fresh preview on the new pixels.
    await adjust.begin();
  };

  const identity = isIdentity(values);

  return (
    <ToolPanel>
      <SectionHeader
        title="Adjustments"
        info="The photo updates as you drag. Each slider's ↺ puts just that one back. Apply makes it one undo step; switching to another tool or photo applies it too."
      />
      {SLIDERS.map((s) => (
        <SizeSlider
          key={s.key}
          label={s.label}
          labelInfo={s.info}
          value={values[s.key]}
          onChange={(v) => set(s.key, v)}
          min={s.min}
          max={s.max}
          unit={s.unit}
          disabled={!imageReady}
          edited={{
            isEdited: values[s.key] !== ADJUST_DEFAULTS[s.key],
            onReset: () => set(s.key, ADJUST_DEFAULTS[s.key]),
            disabled: !imageReady,
          }}
        />
      ))}
      <PanelActionBar layout="split">
        <PanelAction onClick={resetAll} disabled={!imageReady || identity}>
          Reset
        </PanelAction>
        <PanelAction onClick={() => void apply()} disabled={!imageReady || identity}>
          Apply
        </PanelAction>
      </PanelActionBar>
    </ToolPanel>
  );
}
