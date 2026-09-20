import { Link, useLocation } from "react-router-dom";
import { GITHUB_URL, CODEBERG_URL, PAGES, LEGAL_PAGES, external } from "../config";
import { CodebergIcon, GitHubIcon } from "./Icons";

interface FooterProps {
  /** The closing statement. Each page ends on its own sentence. */
  line: string;
}

export default function Footer({ line }: FooterProps) {
  const { pathname } = useLocation();
  // Never link a page to itself — the footer's job is where to go next. The
  // same rule applies to the legal row, which is why it is filtered here too
  // rather than rendered straight from LEGAL_PAGES.
  const links = PAGES.filter((p) => p.to !== pathname);
  const legal = LEGAL_PAGES.filter((p) => p.to !== pathname);

  return (
    <footer className="foot-stmt">
      <p className="foot-stmt__line">{line}</p>
      <div className="foot-stmt__meta">
        <Link className="foot-stmt__mark" to="/">
          <img className="foot-stmt__logo" src="/Image-Horse-Logo.svg" alt="" width={44} height={44} />
          <span>Image&nbsp;Horse</span>
        </Link>

        <ul className="foot-stmt__links">
          {links.map((p) => (
            <li key={p.to}>
              <Link to={p.to}>{p.label}</Link>
            </li>
          ))}
        </ul>

        <ul className="foot-stmt__links foot-stmt__links--legal">
          {legal.map((p) => (
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
      </div>
    </footer>
  );
}
