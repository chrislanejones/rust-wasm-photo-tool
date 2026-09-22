import { Link, useLocation } from "react-router-dom";
import { GITHUB_URL, CODEBERG_URL, PAGES, LEGAL_PAGES, external, repoFile } from "../config";
import { CodebergIcon, GitHubIcon } from "./Icons";

interface FooterProps {
  /** The closing statement. Each page ends on its own sentence. */
  line: string;
}

/* Three columns under the page's closing line:
 *   1. the mark, and what Image Horse is in one paragraph,
 *   2. every page in the nav,
 *   3. the pages the nav leaves out (contact and the legal documents), with
 *      the two source links at the foot of the column,
 * then a copyright row across the bottom.
 *
 * Columns 2 and 3 are projections of ROUTES (seo.ts) through PAGES and
 * LEGAL_PAGES, so a new route lands in the right column by setting or leaving
 * out `footerOnly`, with nothing to edit here. */

/** Stamped at build time (vite.config.ts), so the prerendered HTML and the
 *  hydrated page always agree on it. Reading the clock at render time would
 *  cause a hydration mismatch every January until the next deploy. */
const YEAR = __BUILD_YEAR__;

export default function Footer({ line }: FooterProps) {
  const { pathname } = useLocation();
  // Never link a page to itself. The footer's job is where to go next.
  const links = PAGES.filter((p) => p.to !== pathname);
  const more = LEGAL_PAGES.filter((p) => p.to !== pathname);

  return (
    <footer className="foot-stmt">
      <p className="foot-stmt__line">{line}</p>

      <div className="foot-stmt__cols">
        <div className="foot-stmt__brand">
          <Link className="foot-stmt__mark" to="/">
            <img className="foot-stmt__logo" src="/Image-Horse-Logo.svg" alt="" width={44} height={44} />
            <span>Image&nbsp;Horse</span>
          </Link>
          <p className="foot-stmt__about">
            Image Horse is a free online photo editor for cropping, resizing, annotating,
            compressing, retouching and organizing images. Unlike traditional cloud-based editors,
            most editing happens directly in your browser using Rust and WebAssembly, so your photos
            don&rsquo;t need to be uploaded just to edit them.
          </p>
        </div>

        <nav className="foot-stmt__col" aria-labelledby="foot-pages">
          <p className="foot-stmt__head" id="foot-pages">
            Pages
          </p>
          <ul className="foot-stmt__links">
            {links.map((p) => (
              <li key={p.to}>
                <Link to={p.to}>{p.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="foot-stmt__col" aria-labelledby="foot-more">
          <p className="foot-stmt__head" id="foot-more">
            Contact and legal
          </p>
          <ul className="foot-stmt__links">
            {more.map((p) => (
              <li key={p.to}>
                <Link to={p.to}>{p.label}</Link>
              </li>
            ))}
          </ul>

          <span className="foot-stmt__source">
            <a
              className="nav-pill__icon"
              href={GITHUB_URL}
              title="Source on GitHub"
              aria-label="Source on GitHub"
              {...external}
            >
              <GitHubIcon />
            </a>
            <a
              className="nav-pill__icon"
              href={CODEBERG_URL}
              title="Source on Codeberg"
              aria-label="Source on Codeberg"
              {...external}
            >
              <CodebergIcon />
            </a>
          </span>
        </nav>
      </div>

      <p className="foot-stmt__legal">
        &copy; {YEAR} Chris Lane Jones. The source code is{" "}
        <a href={repoFile("LICENSE")} {...external}>
          MIT licensed
        </a>
        .
      </p>
    </footer>
  );
}
