// The tool tiles from the home page. ButtonSet takes no props — all twelve
// tiles, the roving tabindex and the selection live inside it — so the one
// cell IS the component. Press a tile and the readout line underneath changes;
// that is the whole gesture.
import "./preview.css";
import { ButtonSet as ButtonSetCmp } from "photo-horse-marketing";

export function Default() {
  return <ButtonSetCmp />;
}
