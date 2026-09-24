import { Link, useLocation } from "react-router-dom";
import Footer from "../components/Footer";
import { EDITOR_URL, external } from "../config";
import { TOOL_PAGES, toolPageFor, type RunsOn } from "../data/toolPages";

/* One component for all ten tool landing pages.
 *
 * Each slug is its own route and its own prerendered file with its own <head>,
 * which is what a crawler needs. What it does not need is ten near-identical
 * React files that drift apart the first time one of them is edited, so the
 * page reads its content out of `toolPages.ts` by pathname instead.
 *
 * The nav's mega-menu reads the same file. Before it existed, the menu linked
 * to these ten paths while none of them had a page behind them — every link
 * was a hard 404, which is a white page from the host, not the site's own
 * NotFound.
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

export default function ToolLanding() {
  const { pathname } = useLocation();
  const tool = toolPageFor(pathname);

  // Only reachable if a route were registered without its data. Rendering the
  // shell rather than throwing keeps a prerender failure out of the build.
  if (!tool) return null;

  const runs = RUNS_ON[tool.runsOn];
  const related = tool.related.map((s) => TOOL_PAGES.find((t) => t.slug === s)).filter(Boolean);

  return (
    <>
      <main id="main">
        <header className="page-head">
          <p className="tool-head__eyebrow">{tool.group}</p>
          <h1 className="page-head__title">{tool.h1}</h1>
          <p className="lede">{tool.lede}</p>
          <p className="tool-head__runs">
            <span className={`tool-badge tool-badge--${tool.runsOn}`}>{runs.label}</span>
            <span className="tool-head__note">{runs.note}</span>
          </p>
          <p className="tool-head__actions">
            <a className="cta cta--fill cta--lg" href={EDITOR_URL} {...external}>
              Open the editor
            </a>
          </p>
        </header>

        <article className="post">
          <h2>What it does</h2>
          <ul className="tool-does">
            {tool.does.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>

          {tool.sections.map((s) => (
            <section key={s.h2}>
              <h2>{s.h2}</h2>
              <p>{s.p}</p>
            </section>
          ))}

          <h2>No account needed</h2>
          <p>
            Every tool that runs on your own machine works logged out, with nothing to sign up
            for. Signing in adds sync across your devices and share links; <Link to="/pricing">Pro</Link>{" "}
            adds the passes that need a server. The{" "}
            <Link to="/image-editor-no-upload">no-upload page</Link> draws the line between the
            two, and <Link to="/architecture">Architecture</Link> shows it table by table.
          </p>
        </article>

        {related.length > 0 && (
          <nav className="tool-related" aria-label="Related tools">
            <h2 className="tool-related__title">Next</h2>
            <ul className="tool-related__list">
              {related.map((r) => (
                <li key={r!.slug}>
                  <Link to={r!.slug} className="tool-related__card">
                    <span className="tool-related__group">{r!.group}</span>
                    <span className="tool-related__label">{r!.label}</span>
                    <span className="tool-related__blurb">{r!.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <section className="close">
          <div className="close__body">
            <p className="close__line">It opens in the tab you already have.</p>
            <p className="close__sub">No account, no upload, nothing to install.</p>
            <div className="close__actions">
              <a className="cta cta--fill cta--lg" href={EDITOR_URL} {...external}>
                Open the editor
              </a>
              <Link className="cta cta--outline cta--lg" to="/features">
                See every tool
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer line="Every tool on this page runs in the browser you are reading it in." />
    </>
  );
}
