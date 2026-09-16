import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import { PAGES } from "../config";

/* The page for a URL that isn't one.
 *
 * Before this existed the router had no catch-all, so a mistyped or rotted link
 * got the nav, the footer and nothing in between — served with a 200. That is a
 * "soft 404", and it is worse than a plain missing page: the crawler is told the
 * URL is a real document, indexes an empty one, and comes back to recrawl it.
 * Enough of them and Search Console starts reporting the good pages as thin too.
 *
 * The status code is the other half of the fix and it cannot be set from here —
 * see the `404.html` note in scripts/prerender.mjs for where that comes from.
 */
export default function NotFound() {
  return (
    <>
      <main id="main">
        <header className="page-head">
          <h1 className="page-head__title">That trail doesn't go anywhere.</h1>
          <p className="lede">
            There's no page at this address. It may have been renamed, or the link that sent you here
            may have been wrong to begin with. Everything the site has is below.
          </p>
        </header>

        <nav className="page-body" aria-label="All pages">
          <ul className="notfound__links">
            {PAGES.map((p) => (
              <li key={p.to}>
                <Link to={p.to}>{p.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>

      <Footer line="Everything else is still where you left it." />
    </>
  );
}
