import { useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import { EDITOR_URL, external } from "../config";

/* /coming-soon — what's coming, and how sure we are.
 *
 * Three states and no dates. A date is a promise about a week; a state is a
 * promise about direction, and only one of those is worth making on a project
 * with one person on it. Every entry says which state it is in, so "being
 * built" and "we've thought about it" can never read the same.
 *
 * The entry list sits on a light panel rather than the page's own dark. It is
 * the one block on the site that is a register of things rather than prose,
 * and giving it its own surface says so before a word is read.
 *
 * Entries retire: shipped moves to the Trail Log in the same release, and
 * abandoned comes off with a line saying so. Nothing accumulates here.
 */

interface Entry {
  name: string;
  body?: string;
  /** Already behind a flag in the editor's Beta ring — you can switch it on. */
  beta?: boolean;
}

interface Group {
  key: string;
  short: string;
  name: string;
  stateLabel: string;
  blurb: string;
  items: Entry[];
}

const GROUPS: Group[] = [
  {
    key: "building",
    short: "Building",
    name: "Being built now",
    stateLabel: "building",
    blurb: "Real work, already in the repo, with a branch or a decision behind it.",
    items: [
      {
        name: "More shapes, and shapes you can turn",
        body: "A triangle, a star with as many points as you want, and a handle on every shape so you can rotate it. Hold Shift and it snaps.",
      },
      {
        name: "Send a photo to your other device",
        body: "One photo from your phone to your desktop, one tap — and the server forgets it as soon as the other machine has it.",
      },
      {
        name: "Offline",
        body: "Open the editor with no connection at all and keep working. The engine already runs on your machine; this is the last piece that doesn't.",
      },
      { name: "Smart Brush", body: "Strokes that stop at an edge. Already behind a flag.", beta: true },
      {
        name: "Blur on the graphics card",
        body: "The same blur, on the GPU where there is one. Already behind a flag.",
        beta: true,
      },
    ],
  },
  {
    key: "decided",
    short: "Decided",
    name: "Decided, waiting its turn",
    stateLabel: "decided",
    blurb: "Chosen and written down. Not started.",
    items: [
      {
        name: "Bring your own typeface",
        body: "Upload a font and use it on your text. The editor learned to load fonts at runtime this month; this is the half that lets you choose one.",
      },
      {
        name: "Camera data, handled properly",
        body: "Read and write the information your camera embeds — keep it, strip it, or drop just the location — without leaving the tab.",
      },
      {
        name: "Rename a batch with a look at each photo",
        body: "The AI rename pass, finished: it looks at the image, not just the filename.",
      },
      { name: "Photoshop's blend modes", body: "Multiply, screen, overlay and the rest, on real layer stacks." },
      { name: "Talk to it", body: "Say what you want changed instead of finding the tool." },
      {
        name: "Your own tools, plugged in",
        body: "A plugin door, so a tool someone else writes can sit in the toolbar beside the built-in ones.",
      },
    ],
  },
  {
    key: "exploring",
    short: "Exploring",
    name: "Thinking about it",
    stateLabel: "exploring",
    blurb: "Ideas with reasons behind them and no timeline.",
    items: [
      {
        name: "Record what you did, then do it to a hundred photos",
        body: "Macro recording, so an edit becomes something you can replay across a folder.",
      },
      {
        name: "Every version of a photo, as a tree",
        body: "Not just undo — every branch you took, kept and walkable.",
      },
      {
        name: "Two people, one photo, at the same time",
        body: "The furthest thing on the list, and the one everything else is quietly building toward.",
      },
      { name: "Photoshop files, in and out" },
      { name: "Colour-blind-safe previews" },
    ],
  },
];

const TOTAL = GROUPS.reduce((n, g) => n + g.items.length, 0);

const HONEST: { strong: string; rest: string }[] = [
  {
    strong: "Every entry shows its state.",
    rest: "Being built, decided, or thinking about it — you can tell the difference.",
  },
  { strong: "No dates.", rest: "A missed date is worth less than the honesty it costs." },
  {
    strong: "Nothing goes up the code can't already partly do",
    rest: "— unless it's marked as something we're thinking about.",
  },
  {
    strong: "Entries retire.",
    rest: "Shipped moves to the Trail Log in the same release. Abandoned comes off and says so once.",
  },
];

export default function ComingSoon() {
  const [active, setActive] = useState("all");
  const shown = GROUPS.filter((g) => active === "all" || g.key === active);

  const tiles = [
    { key: "all", label: "All", count: `${TOTAL} entries` },
    ...GROUPS.map((g) => ({ key: g.key, label: g.short, count: `${g.items.length} entries` })),
  ];

  return (
    <>
      <main id="main">
        <header className="soon-head">
          <div className="soon-head__lead">
            <p className="soon-head__eyebrow">What&rsquo;s coming &middot; {TOTAL} entries, no dates</p>
            <h1 className="soon-head__title">What&rsquo;s coming, and how sure we are.</h1>
          </div>
          <p className="soon-head__deck">
            Everything below is either being built, decided on, or thought about &mdash; it says
            which. There are no dates, because we ship when it&rsquo;s ready and that varies. When
            something lands it moves to the <Link to="/trail-log">Trail Log</Link>, where you can
            see the commit that did it.
          </p>
        </header>

        <section className="soon-filter" aria-label="Filter by state">
          <div role="group" className="soon-filter__grid">
            {tiles.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={active === t.key}
                className={`soon-tile${active === t.key ? " is-on" : ""}`}
                onClick={() => setActive((a) => (a === t.key ? "all" : t.key))}
              >
                <span className="soon-tile__label">{t.label}</span>
                <span className="soon-tile__count">{t.count}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="soon-board" aria-label="Entries">
          {shown.map((g) => (
            <div className="soon-group" key={g.key}>
              <div className="soon-group__head">
                <h2 className="soon-group__name">
                  <span aria-hidden="true" className={`soon-dot soon-dot--${g.key}`} />
                  {g.name}
                  <span className="soon-group__count">{g.items.length}</span>
                </h2>
                <p className="soon-group__blurb">{g.blurb}</p>
              </div>
              <ul className="soon-cards">
                {g.items.map((f) => (
                  <li className="soon-card" key={f.name}>
                    <div className="soon-card__top">
                      <span className={`soon-card__state soon-card__state--${g.key}`}>
                        {g.stateLabel}
                      </span>
                      {f.beta && (
                        <a className="soon-card__beta" href={EDITOR_URL} {...external}>
                          try it in Beta &rarr;
                        </a>
                      )}
                    </div>
                    <h3 className="soon-card__name">{f.name}</h3>
                    {f.body && <p className="soon-card__body">{f.body}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="soon-honest">
          <h2 className="soon-honest__title">How this list stays honest</h2>
          <ul className="soon-honest__list">
            {HONEST.map((h, i) => (
              <li key={h.strong}>
                <span className="soon-honest__num">{i + 1}</span>
                <span>
                  <strong>{h.strong}</strong> {h.rest}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Footer line="Nothing here is a promise about a date. All of it is a promise about direction." />
    </>
  );
}
