// The floating pill nav and its two mega menus (Tools, Learn).
//
// Two required props, both owned by the page: `onOpenSearch` opens the command
// palette (Ctrl+K lives on the page, not in here) and `searchOpen` is how the
// nav knows to mark its search affordance as active. The nav holds its own
// open-menu, mobile-sheet and scroll-condense state.
//
// It is position: fixed. The preview card renders single-story inside a
// transformed wrapper, which makes that wrapper the containing block, so the
// bar stays in the card instead of escaping to the page viewport.
//
// Hover Tools or Learn to open a mega menu; it closes on a 160 ms delay.
import "./preview.css";
import { useState } from "react";
import { Nav as NavCmp } from "photo-horse-marketing";

export function Default() {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <div style={{ minHeight: 220 }}>
      <NavCmp searchOpen={searchOpen} onOpenSearch={() => setSearchOpen((s) => !s)} />
    </div>
  );
}
