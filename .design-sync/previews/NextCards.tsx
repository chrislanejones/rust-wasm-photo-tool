// The four-card "Next" grid that closes every page.
//
// It picks NOTHING — `cards` arrives already chosen, which is what makes it
// safe under prerender + hydration (the site's picker is seeded by page path
// for exactly that reason; see data/nextCards.ts). So a preview hands it a
// literal array, the same as a page does.
//
// Card copy is real site copy: the group is the nav group, the blurb is one
// sentence in sentence case, and the CSS clamps the blurb at 4 lines.
import "./preview.css";
import { NextCards as NextCardsCmp } from "photo-horse-marketing";

const CARDS = [
  {
    to: "/what-is-ora",
    group: "Learn",
    label: "What is .ora?",
    blurb: "The open layered image format, and why it is a zip file full of PNGs.",
  },
  {
    to: "/features",
    group: "Product",
    label: "Features",
    blurb: "Every tool in the editor, and what each one is actually for.",
  },
  {
    to: "/trail-log",
    group: "Project",
    label: "Trail Log",
    blurb: "Every release, newest first, with what changed in each one.",
  },
  {
    to: "/blog/offline-by-construction",
    group: "Blog",
    label: "Offline by construction",
    blurb: "The hotel Wi-Fi died and the editor did not notice.",
  },
];

/* Four cards, the standard close. */
export function Default() {
  return <NextCardsCmp cards={CARDS} />;
}

/* The heading and the landmark label are both overridable — the .ora pages
   use "Keep reading" so two adjacent grids do not both say "Next". */
export function CustomHeading() {
  return <NextCardsCmp cards={CARDS.slice(0, 2)} heading="Keep reading" label="More about .ora" />;
}
