import { Link, useLocation } from "react-router-dom";
import { GITHUB_URL, CODEBERG_URL, PAGES, LEGAL_PAGES, external, repoFile } from "../config";
import { CodebergIcon, GitHubIcon } from "./Icons";
import HorseTrot from "./HorseTrot";

interface FooterProps {
  /** The closing statement. Each page ends on its own sentence. */
  line: string;
  /** The trotting horse beside the line. Home and the 404. */
  horse?: boolean;
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
 * out `footerOnly`, with nothing to edit here. Home is left out of "Pages"
 * because the mark in column 1 already goes there. */

/** Stamped at build time (vite.config.ts), so the prerendered HTML and the
 *  hydrated page always agree on it. Reading the clock at render time would
 *  cause a hydration mismatch every January until the next deploy. */
const YEAR = __BUILD_YEAR__;

export default function Footer({ line, horse = false }: FooterProps) {
  const { pathname } = useLocation();
  // Never link a page to itself. The footer's job is where to go next.
  const links = PAGES.filter((p) => p.to !== "/" && p.to !== pathname);
  const more = LEGAL_PAGES.filter((p) => p.to !== pathname);

  return (
    <footer className="sfoot">
      <div className="sfoot__top">
        <p className="sfoot__line">{line}</p>
        {horse && <HorseTrot />}
      </div>

      <div className="sfoot__cols">
        <div className="sfoot__col">
          <Link className="sfoot__mark" to="/">
            <img className="sfoot__logo" src="/Image-Horse-Logo.svg" alt="" width={44} height={44} />
            <span>Image&nbsp;Horse</span>
          </Link>
          <p className="sfoot__about">
            Image Horse is a free online photo editor for cropping, resizing, annotating,
            compressing, retouching and organizing images. Most editing happens directly in your
            browser, so your photos don&rsquo;t need to be uploaded just to edit them.
          </p>
        </div>

        <nav className="sfoot__col" aria-labelledby="sfoot-pages">
          <p className="sfoot__head" id="sfoot-pages">
            Pages
          </p>
          <ul className="sfoot__links sfoot__links--grid">
            {links.map((p) => (
              <li key={p.to}>
                <Link to={p.to}>{p.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="sfoot__col" aria-labelledby="sfoot-more">
          <p className="sfoot__head" id="sfoot-more">
            Contact and legal
          </p>
          <ul className="sfoot__links">
            {more.map((p) => (
              <li key={p.to}>
                <Link to={p.to}>{p.label}</Link>
              </li>
            ))}
          </ul>

          <span className="sfoot__source">
            <a
              className="sfoot__icon"
              href={GITHUB_URL}
              title="Source on GitHub"
              aria-label="Source on GitHub"
              {...external}
            >
              <GitHubIcon />
            </a>
            <a
              className="sfoot__icon"
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

      <p className="sfoot__legal">
        &copy; {YEAR} Chris Lane Jones. The source code is{" "}
        <a href={repoFile("LICENSE")} {...external}>
          MIT licensed
        </a>
        .
      </p>
    </footer>
  );
}
