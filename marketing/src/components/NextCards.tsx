import { Link } from "react-router-dom";
import type { NextCard } from "../data/nextCards";

/* The "Next" card grid that closes every page.
 *
 * The markup lived twice — /openraster wrote it out with its own four-card
 * array, ToolLanding wrote the same nine lines against `related`. Both are
 * gone; this is the only copy. Classes stay `tp-*` because the CSS in
 * tool-page.css is unchanged and the grid is the same object it always was.
 *
 * `cards` is already chosen by the caller (see data/nextCards.ts). This
 * component picks nothing: it renders what it is handed, which is what makes
 * it safe under prerender + hydration.
 */
export default function NextCards({
  cards,
  heading = "Next",
  label = "Related pages",
}: {
  cards: readonly NextCard[];
  /** The visible <h2>. */
  heading?: string;
  /** aria-label on the <nav>, for a screen reader's landmark list. */
  label?: string;
}) {
  if (!cards.length) return null;

  return (
    <nav className="tp-next" aria-label={label}>
      <h2 className="tp-next__h2">{heading}</h2>
      <ul className="tp-next__list">
        {cards.map((c) => (
          <li className="tp-next__li" key={c.to}>
            <Link className="tp-next__card" to={c.to}>
              <span className="tp-next__group">{c.group}</span>
              <span className="tp-next__label">{c.label}</span>
              <span className="tp-next__blurb">{c.blurb}</span>
              <span className="tp-next__slug">{c.to} &rarr;</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
