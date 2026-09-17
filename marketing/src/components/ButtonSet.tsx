import { useState } from "react";
import {
  BrushIcon,
  CropIcon,
  DownloadIcon,
  ExportIcon,
  LayersIcon,
  ResizeIcon,
  UndoIcon,
  WandIcon,
} from "./Icons";

/* The editor's own controls, on the home page, as real buttons.
 *
 * This was a 832×859 WebP screenshot (`/button-set.webp`). A picture of
 * buttons asks the reader to take the interface on trust; eight real ones let
 * them press it. Nothing here edits anything — the only thing a press changes
 * is which button is selected.
 *
 * ⚠️ EVERY BUTTON HERE CARRIES AN ICON, and that is a constraint rather than a
 * coincidence. The screenshot also showed "Apply", which is a text action — it
 * is the button that DOES the thing, and a dead one sitting in a row a reader
 * can actually click is a promise the page cannot keep. Tools are a selection,
 * so a tool that only highlights is honest. Actions are not. If a control needs
 * a word to say what it does, it does not belong in this set.
 *
 * Selection is single-choice and starts on Paint, so the set never renders in a
 * state the real editor could not be in.
 */

const TOOLS = [
  { id: "paint", label: "Paint", Icon: BrushIcon },
  { id: "wand", label: "Magic Wand", Icon: WandIcon },
  { id: "crop", label: "Crop", Icon: CropIcon },
  { id: "resize", label: "Resize", Icon: ResizeIcon },
  { id: "layers", label: "Layers", Icon: LayersIcon },
  { id: "undo", label: "Undo", Icon: UndoIcon },
  { id: "download", label: "Download", Icon: DownloadIcon },
  { id: "export", label: "Export", Icon: ExportIcon },
] as const;

export default function ButtonSet() {
  const [selected, setSelected] = useState<string>("paint");

  return (
    /* A toolbar, not a list of buttons: it tells a screen reader these belong
       together, and `aria-pressed` on each one is what carries the selected
       state — the ring is the sighted half of the same fact, never the only
       half. The group is labeled because "Paint, Magic Wand, Crop…" read out
       with no preamble is a puzzle. */
    <div className="buttonset" role="toolbar" aria-label="Some of the editor's controls">
      {TOOLS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="buttonset__btn"
          aria-pressed={selected === id}
          onClick={() => setSelected(id)}
        >
          <Icon className="buttonset__icon" />
          {/* The name is available to assistive tech and to a find-in-page, but
              never drawn — these are the app's icon-only controls and a visible
              caption would make them a different component. */}
          <span className="visually-hidden">{label}</span>
        </button>
      ))}
    </div>
  );
}
