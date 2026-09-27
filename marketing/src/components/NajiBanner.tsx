import { Link } from "react-router-dom";

/* The bar above the nav on every page: Naji, the horse the editor is named
 * after, is still in Virginia, and we are working on bringing him to
 * Jacksonville. The whole bar links to his section of the About page.
 *
 * A plan, not a plea. It says what we are doing and invites you to meet him;
 * it does not ask for anything.
 *
 * Layout: pinned, one line, fixed height — see `.naji-bar` in styles.css and
 * `--announce-height` in tokens.css, which the nav and every page offset read.
 *
 * Rendered AFTER the skip link in App.tsx, so "Skip to content" stays the first
 * Tab stop (scripts/check-skip-links.mjs fails otherwise).
 *
 * Static content with nothing read from storage, so the prerendered HTML and
 * the hydrated tree always match.
 */
export default function NajiBanner() {
  return (
    <Link className="naji-bar" to="/about#naji">
      <span className="naji-bar__long">
        We&rsquo;re working on bringing Naji &mdash; the horse behind the name &mdash; home to Jacksonville.
      </span>
      <span className="naji-bar__short">Bringing Naji home to Jacksonville.</span>
      <span className="naji-bar__cta">
        {/* The words go below 380px — the whole bar is the link, so they are
            the part that can. The arrow stays, so it still reads as tappable. */}
        <span className="naji-bar__cta-word">Meet Naji </span>
        <span aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}
