import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  BrushIcon,
  CropIcon,
  EmojiIcon,
  EraserIcon,
  ExportIcon,
  LayersIcon,
  ResizeIcon,
  ShapesIcon,
  StampIcon,
  TextIcon,
  UndoIcon,
  WandIcon,
} from "./Icons";

/* The editor's tool tiles, on the home page, as real buttons.
 *
 * Twelve tiles in four columns, each the app's own silhouette — glyph on top,
 * name underneath, the way Paint, Stamp and Text sit in the editor's rail.
 * This started as an 832×859 WebP screenshot, became eight icon-only buttons
 * on 09-16, and got its names the day after: an icon a reader has to guess at
 * is a picture with extra steps, and a tile that says what it is can be
 * pressed with some idea of what would happen.
 *
 * Nothing here edits anything. A press changes which tile is selected and
 * nothing else. That is honest for a tool — selecting one IS the whole
 * gesture — and would not be for an action, which is why "Apply" from the
 * screenshot never made it in. Download went when the names arrived: its
 * glyph was the odd shape out, and a tile that says "Download" and downloads
 * nothing is a promise the page cannot keep.
 *
 * Selection is single-choice and starts on Paint, so the set never renders in
 * a state the real editor could not be in.
 */

const TOOLS = [
  { id: "paint", label: "Paint", Icon: BrushIcon, blurb: "freehand strokes with a stabilizer for shaky hands" },
  { id: "stamp", label: "Stamp", Icon: StampIcon, blurb: "clone one area over another, or batch-stamp a logo" },
  { id: "text", label: "Text", Icon: TextIcon, blurb: "labels and speech bubbles in three typefaces" },
  { id: "shapes", label: "Shapes", Icon: ShapesIcon, blurb: "rectangles, ellipses, arrows and callout pins" },
  { id: "emoji", label: "Emoji", Icon: EmojiIcon, blurb: "drop one on the photo, sized however you like" },
  { id: "eraser", label: "Eraser", Icon: EraserIcon, blurb: "rub out strokes or mask parts of a layer" },
  { id: "wand", label: "Wand", Icon: WandIcon, blurb: "select by color, then blur, cut or recolor it" },
  { id: "crop", label: "Crop", Icon: CropIcon, blurb: "straighten, fix perspective, trim to a ratio" },
  { id: "resize", label: "Resize", Icon: ResizeIcon, blurb: "to a pixel size or a file size, one or forty at once" },
  { id: "layers", label: "Layers", Icon: LayersIcon, blurb: "a real stack, with opacity and masks" },
  { id: "undo", label: "Undo", Icon: UndoIcon, blurb: "a thousand steps back, kept between visits" },
  { id: "export", label: "Export", Icon: ExportIcon, blurb: "PNG, JPEG, WebP, AVIF or a layered .ora" },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

/** Columns in the grid. Must match `.buttonset { grid-template-columns }` in
 *  styles.css — the arrow keys walk the grid by this number, and a CSS-only
 *  change here would make Down land on the wrong tile. */
const COLS = 4;

export default function ButtonSet() {
  const [selected, setSelected] = useState<ToolId>("paint");
  // Which tile Tab lands on. A toolbar is ONE tab stop with the arrow keys
  // moving inside it (WAI-ARIA toolbar pattern); twelve stops on the way to
  // the rest of the page would be a wall for anyone on a keyboard.
  const [roving, setRoving] = useState(0);
  // Bumped on every press. The pressed tile's face is keyed on it, so the
  // face remounts and its pop plays again — including a second press on the
  // tile that is already selected, which a class toggle alone could not do.
  const [press, setPress] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const current = TOOLS.find((t) => t.id === selected) ?? TOOLS[0];

  const focus = (i: number) => {
    setRoving(i);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = TOOLS.length;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
        next = (i + 1) % n;
        break;
      case "ArrowLeft":
        next = (i - 1 + n) % n;
        break;
      case "ArrowDown":
        next = i + COLS < n ? i + COLS : i;
        break;
      case "ArrowUp":
        next = i - COLS >= 0 ? i - COLS : i;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
    }
    if (next === null) return;
    e.preventDefault();
    focus(next);
  };

  return (
    /* A toolbar, not a list of buttons: it tells a screen reader these belong
       together, and `aria-pressed` on each one is what carries the selected
       state — the ring is the sighted half of the same fact, never the only
       half. The group is labeled because "Paint, Stamp, Text…" read out with
       no preamble is a puzzle. */
    <div className="buttonset__wrap">
      <div className="buttonset" role="toolbar" aria-label="Some of the editor's tools">
      {TOOLS.map(({ id, label, Icon }, i) => {
        const pressed = selected === id;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            className="buttonset__btn"
            aria-pressed={pressed}
            tabIndex={roving === i ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => {
              setSelected(id);
              setRoving(i);
              setPress((p) => p + 1);
            }}
          >
            {/* The face is what pops. `is-pop` only ever lands on the tile
                that was just pressed, never on the one selected at load, so
                the page does not open with Paint bouncing at the reader. */}
            <span
              key={pressed ? press : "idle"}
              className={`buttonset__face${pressed && press > 0 ? " is-pop" : ""}`}
            >
              <Icon className="buttonset__icon" />
              <span className="buttonset__label">{label}</span>
            </span>
          </button>
        );
      })}
      </div>

      {/* What the selected tile actually does. The tiles are named but a name
          is not a description, and this is the line that makes pressing one
          worth doing. `aria-live` because the only thing that changed on the
          press is text somewhere else on the page. */}
      <p className="buttonset__readout" aria-live="polite">
        Selected: <span className="buttonset__readout-tool">{current.label}</span> &mdash;{" "}
        {current.blurb}
      </p>
    </div>
  );
}
