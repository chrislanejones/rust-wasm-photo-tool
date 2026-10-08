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
// Now: opening the panel starts a session over an untouched copy
// (src/adjust.rs). Dragging previews live; RELEASING saves it as one undo
// step (`adjust.commit`), so it survives a reload or a closed tab; every ↺ is
// exact because each step is recomputed from the copy. Leaving the panel or
// switching photo commits anything still moving (lib/pendingEdits).
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
  /** Moves on every history step — an undo while the panel is open resets it. */
  undoCount?: number;
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

const same = (a: AdjustValues, b: AdjustValues) =>
  (Object.keys(ADJUST_DEFAULTS) as Key[]).every((k) => a[k] === b[k]);

export function EffectsSettings({ adjust, imageReady, activePhotoId, undoCount }: EffectsSettingsProps) {
  const [values, setValues] = useState<AdjustValues>(ADJUST_DEFAULTS);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  /** What the engine has committed this session. */
  const committedRef = useRef<AdjustValues>(ADJUST_DEFAULTS);
  /** History steps this panel itself made — an undo/redo is anything else. */
  const ownStepsRef = useRef(0);

  const commitNow = async (v: AdjustValues = valuesRef.current) => {
    if (!adjust || same(v, committedRef.current)) return;
    committedRef.current = v;
    ownStepsRef.current += 1;
    if (!(await adjust.commit(v))) ownStepsRef.current -= 1;
  };

  // Leaving the panel for another tool commits anything still moving
  // (declared first, so on unmount it runs before the session's cancel).
  useEffect(
    () => () => {
      void commitNow();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
    [],
  );

  // A photo switch commits onto the OUTGOING photo before it saves it.
  useEffect(() => {
    if (!adjust) return;
    return registerPendingCommit(() => commitNow());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commitNow reads refs
  }, [adjust]);

  // One session per photo for as long as the panel is open on an image.
  useEffect(() => {
    if (!adjust || !imageReady) return;
    void adjust.begin();
    return () => {
      void adjust.cancel();
      committedRef.current = ADJUST_DEFAULTS;
      setValues(ADJUST_DEFAULTS);
    };
  }, [adjust, imageReady, activePhotoId]);

  // An undo/redo from outside the panel moves the photo out from under the
  // session: the sliders go back to neutral on the undone photo.
  const lastUndoRef = useRef(undoCount);
  useEffect(() => {
    if (lastUndoRef.current === undoCount) return;
    lastUndoRef.current = undoCount;
    if (ownStepsRef.current > 0) {
      ownStepsRef.current -= 1;
      return;
    }
    if (!adjust || !imageReady) return;
    committedRef.current = ADJUST_DEFAULTS;
    setValues(ADJUST_DEFAULTS);
    void (async () => {
      await adjust.cancel();
      await adjust.begin();
    })();
  }, [undoCount, adjust, imageReady]);

  const set = (key: Key, v: number) => {
    const next = { ...valuesRef.current, [key]: v };
    valuesRef.current = next;
    setValues(next);
    adjust?.preview(next);
  };

  const resetOne = (key: Key) => {
    set(key, ADJUST_DEFAULTS[key]);
    void commitNow();
  };

  const resetAll = () => {
    valuesRef.current = ADJUST_DEFAULTS;
    setValues(ADJUST_DEFAULTS);
    adjust?.preview(ADJUST_DEFAULTS);
    void commitNow(ADJUST_DEFAULTS);
  };

  const identity = isIdentity(values);

  return (
    <ToolPanel>
      <SectionHeader
        title="Adjustments"
        info="The photo updates as you drag, and each release is one undo step. Each slider's ↺ puts just that one back, exactly; Reset puts them all back."
      />
      {SLIDERS.map((s) => (
        <SizeSlider
          key={s.key}
          label={s.label}
          labelInfo={s.info}
          value={values[s.key]}
          onChange={(v) => set(s.key, v)}
          onCommit={() => void commitNow()}
          min={s.min}
          max={s.max}
          unit={s.unit}
          disabled={!imageReady}
          edited={{
            isEdited: values[s.key] !== ADJUST_DEFAULTS[s.key],
            onReset: () => resetOne(s.key),
            disabled: !imageReady,
          }}
        />
      ))}
      <PanelActionBar>
        <PanelAction onClick={resetAll} disabled={!imageReady || identity}>
          Reset
        </PanelAction>
      </PanelActionBar>
    </ToolPanel>
  );
}
