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
  { id: "paint", label: "Paint", Icon: BrushIcon },
  { id: "stamp", label: "Stamp", Icon: StampIcon },
  { id: "text", label: "Text", Icon: TextIcon },
  { id: "shapes", label: "Shapes", Icon: ShapesIcon },
  { id: "emoji", label: "Emoji", Icon: EmojiIcon },
  { id: "eraser", label: "Eraser", Icon: EraserIcon },
  { id: "wand", label: "Wand", Icon: WandIcon },
  { id: "crop", label: "Crop", Icon: CropIcon },
  { id: "resize", label: "Resize", Icon: ResizeIcon },
  { id: "layers", label: "Layers", Icon: LayersIcon },
  { id: "undo", label: "Undo", Icon: UndoIcon },
  { id: "export", label: "Export", Icon: ExportIcon },
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
  );
}
