// The site footer. Three columns under the page's own closing line.
//
// `line` is required and every page passes its own sentence — the footer is
// the last thing read, so it is not a place for boilerplate.
//
// The `horse` prop adds the trotting horse beside the line (Home and the 404
// use it). It is deliberately not previewed: HorseTrot draws on a canvas and
// wants a GPU adapter the design runtime may not have, and a card showing a
// blank rectangle would be worse than a card that shows the footer.
//
// It reads useLocation to avoid linking the current page to itself, so the
// preview sees whatever path the MemoryRouter provider is on.
import "./preview.css";
import { Footer as FooterCmp } from "photo-horse-marketing";

export function Default() {
  return (
    <FooterCmp line="Edit your photos in the browser. Nothing uploads unless you ask it to." />
  );
}
