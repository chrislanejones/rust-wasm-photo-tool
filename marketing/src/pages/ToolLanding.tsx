import { Link, useLocation } from "react-router-dom";
import Footer from "../components/Footer";
import NextCards from "../components/NextCards";
import { pickNextCards } from "../data/nextCards";
import { EDITOR_URL, external } from "../config";
import { toolPageFor, type RunsOn } from "../data/toolPages";

/* One component for all ten tool landing pages, ported from the ToolPage v2
 * design.
 *
 * Each slug is its own route and its own prerendered file with its own <head>,
 * which is what a crawler needs. The page reads its content out of
 * `toolPages.ts` by pathname, so ten pages cannot drift apart. The nav's
 * mega-menu reads the same file.
 *
 * The body sits on a cream panel, like the home page's. Everything a reader
 * scans — what it does, the reasoning, the no-account note — is on the light
 * surface, and the dark page around it carries only the pitch and the way out.
 */

const RUNS_ON: Record<RunsOn, { label: string; note: string }> = {
  local: {
    label: "Runs on your machine",
    note: "Nothing is uploaded. With the network switched off, this still works.",
  },
  server: {
    label: "Runs on a server · Pro",
    note: "The photo is sent up and the result comes back. The job is deleted afterwards.",
  },
  both: {
    label: "Mostly on your machine",
    note: "The free path never uploads. The optional AI pass runs on a server and needs Pro.",
  },
};

function Check() {
  return (
    <svg
      className="tp-does__check"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function ToolLanding() {
  const { pathname } = useLocation();
  const tool = toolPageFor(pathname);

  // Only reachable if a route were registered without its data. Rendering
  // nothing rather than throwing keeps a prerender failure out of the build.
  if (!tool) return null;

  const runs = RUNS_ON[tool.runsOn];

  // `related` names three sibling tools and the grid holds four, so the page
  // used to end one card short of everywhere else. The three stay first — they
  // are hand-picked and better than any shuffle — and the fourth is seeded off
  // this path, which is also the only card here that can reach the writing,
  // the log or the .ora pages.
  const cards = pickNextCards(tool.slug, tool.related);

  return (
    <>
      <main id="main" className="tp">
        <header className="tp-head">
          <div className="tp-head__lead">
            <p className="tp-head__eyebrow">{tool.group}</p>
            <h1 className="tp-head__title">{tool.h1}</h1>
          </div>
          <div className="tp-head__side">
            <p className="tp-head__lede">{tool.lede}</p>
            <div className="tp-actions">
              <a className="tp-btn tp-btn--fill" href={EDITOR_URL} {...external}>
                Open the editor
              </a>
              <Link className="tp-btn tp-btn--line" to="/features">
                See every tool
              </Link>
            </div>
          </div>
        </header>

        {/* A server tool gets the accent border and a warm wash, so "this one
            uploads" is the loudest thing above the fold rather than a footnote. */}
        <section className="tp-runs-wrap" aria-label="Where it runs">
          <div className={`tp-runs tp-runs--${tool.runsOn}`}>
            <span className="tp-runs__label">
              <span className="tp-runs__dot" aria-hidden="true" />
              {runs.label}
            </span>
            <p className="tp-runs__note">{runs.note}</p>
          </div>
        </section>

        <article className="tp-board">
          <section className="tp-does">
            <h2 className="tp-board__h2">What it does</h2>
            <ul className="tp-does__list">
              {tool.does.map((d) => (
                <li className="tp-does__item" key={d}>
                  <Check />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </section>

          {tool.sections.map((s) => (
            <section className="tp-split" key={s.h2}>
              <h2 className="tp-split__h2">{s.h2}</h2>
              <p className="tp-split__p">{s.p}</p>
            </section>
          ))}

          <section className="tp-split">
            <h2 className="tp-split__h2">No account needed</h2>
            <p className="tp-split__p">
              Every tool that runs on your own machine works logged out, with nothing to sign up
              for. Signing in adds sync across your devices and share links;{" "}
              <Link to="/pricing">Pro</Link> adds the passes that need a server. The{" "}
              <Link to="/image-editor-no-upload">no-upload page</Link> draws the line between the
              two, and <Link to="/architecture">Architecture</Link> shows it table by table.
            </p>
          </section>
        </article>

        <NextCards cards={cards} label="Related pages" />

        <section className="tp-close">
          <div className="tp-close__text">
            <p className="tp-close__line">It opens in the tab you already have.</p>
            <p className="tp-close__sub">No account, no upload, nothing to install.</p>
          </div>
          <a className="tp-btn tp-btn--fill" href={EDITOR_URL} {...external}>
            Open the editor
          </a>
        </section>
      </main>

      <Footer line="Every tool on this page runs in the browser you are reading it in." />
    </>
  );
}
