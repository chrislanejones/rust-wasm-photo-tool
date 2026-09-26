import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Footer from "./Footer";
import OraFaq from "./OraFaq";
import OraViewer, { type OraViewerMode } from "./OraViewer";
import type { Faq } from "../data/openraster";

/* The shape the three small OpenRaster pages share — /what-is-ora,
 * /ora-to-png, /ora-to-psd: a head, the viewer, a cream board with one
 * section and the questions, then links to the other three pages. Each page
 * passes its own words; the order and the classes live here so the three
 * cannot drift apart. /openraster is the long page and has its own file. */

const LINKS = [
  { to: "/ora-to-png", label: "Convert .ora to PNG" },
  { to: "/ora-to-psd", label: "Convert .ora to PSD" },
  { to: "/what-is-ora", label: "What is a .ora file?" },
];

export default function OraSubPage(props: {
  /** This page's path, left out of the links at the foot. */
  path: string;
  eyebrow: "Learn" | "Convert";
  title: string;
  lede: string;
  mode: OraViewerMode;
  viewerLabel: string;
  heading: string;
  body: ReactNode;
  faq: readonly Faq[];
  /** The filled link back to /openraster. */
  guide: string;
  footer: string;
}) {
  return (
    <>
      <main id="main" className="ora-sub">
        <header className="tp-head">
          <div className="tp-head__lead">
            <p className="tp-head__eyebrow">
              {props.eyebrow} · <Link to="/openraster">OpenRaster</Link>
            </p>
            <h1 className="tp-head__title">{props.title}</h1>
          </div>
          <div className="tp-head__side">
            <p className="tp-head__lede">{props.lede}</p>
          </div>
        </header>

        <section className="ora-wrap" aria-label={props.viewerLabel}>
          <OraViewer mode={props.mode} />
        </section>

        <article className="tp-board">
          <section className="ora-what">
            <h2 className="tp-board__h2">{props.heading}</h2>
            {props.body}
          </section>
          <section className="tp-split">
            <h2 className="tp-split__h2">Questions</h2>
            <OraFaq faq={props.faq} />
          </section>
        </article>

        <nav className="ora-links" aria-label="Related pages">
          <Link className="tp-btn tp-btn--fill" to="/openraster">
            {props.guide}
          </Link>
          {LINKS.filter((l) => l.to !== props.path).map((l) => (
            <Link key={l.to} className="tp-btn tp-btn--line" to={l.to}>
              {l.label}
            </Link>
          ))}
        </nav>
      </main>

      <Footer line={props.footer} />
    </>
  );
}
