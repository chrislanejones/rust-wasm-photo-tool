import { useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import ShotTimeline from "../components/ShotTimeline";
import ButtonSet from "../components/ButtonSet";
import CubeLetters from "../components/CubeLetters";
import { CpuIcon, ListIcon, ServerIcon } from "../components/Icons";
import { SHOTS } from "../data/shots";
import { POSTS, fmtPostDate, postPath } from "../data/posts";
import { EDITOR_URL, GITHUB_URL, external } from "../config";

type Where = "all" | "local" | "server";

interface Op {
  op: React.ReactNode;
  where: Exclude<Where, "all">;
  detail: React.ReactNode;
}

/* Every operation, and the machine it runs on.
 *
 * The table is the page's proof, not its decoration: "your photos stay on your
 * computer" is a claim every editor makes, and this is the row-by-row version
 * that can be checked. The two server rows stay in it for the same reason —
 * a list of only the flattering half is an advertisement. */
const OPS: Op[] = [
  { op: "Crop, resize, filters, presets", where: "local", detail: "Your processor does the maths, in the page" },
  { op: "Arrows, pins, text, blur and redaction", where: "local", detail: "Real layers, so you can move or undo any of it" },
  { op: "Shrinking to PNG · JPEG · WebP · AVIF", where: "local", detail: "Resize and compress in one step" },
  {
    op: "Your originals and edit history",
    where: "local",
    detail: (
      <>
        Kept in this browser, undo to <span className="fig">1000</span> steps
      </>
    ),
  },
  { op: "Camera data (location, device)", where: "local", detail: "Keep it, strip it, or drop just the GPS" },
  {
    op: "Remove background, remove object, read text",
    where: "server",
    detail: "AI models that don't fit in a browser — sign in first",
  },
  { op: "Sync and share links", where: "server", detail: "Optional — the free editor never uploads" },
];

const FILTERS = [
  { key: "all", label: "Everything", Icon: ListIcon },
  { key: "local", label: "Your computer", Icon: CpuIcon },
  { key: "server", label: "A server, signed in", Icon: ServerIcon },
] as const;

/* The three people the five-minute picture job keeps landing on. Numbered
 * rather than iconed: these are audiences, and an icon for "you run a shop"
 * is a stock illustration pretending to be information. */
const AUDIENCES = [
  {
    n: "01",
    who: "You've got a screenshot",
    title: "Circle the bug, blur the email, paste it in Slack.",
    body: "Arrows, boxes, numbered pins and text bubbles in the tool rail. Black-box or pixelate anything that shouldn't be in there. Thirty seconds, nothing to install.",
    tags: ["Arrows", "Callout pins", "Redaction", "Crop"],
  },
  {
    n: "02",
    who: "You run a shop or a brand",
    title: "Forty product photos, one pass.",
    body: "Resize and compress a whole folder at once, stamp your logo on every frame, rename the files by what's actually in them, and export to WebP or AVIF for a faster page.",
    tags: ["Batch resize", "Logo stamp", "Twelve presets", "WebP · AVIF"],
  },
  {
    n: "03",
    who: "You'd rather not upload it",
    title: "Passport scans. Medical images. The kids.",
    body: "The editing happens on your computer, inside the tab. Once the page has loaded, the network is optional — pull the plug mid-edit and nothing stops.",
    tags: ["Strip GPS", "Works offline", "Saved in this browser"],
  },
];

const CAPTION_BASE = "Every operation, and the machine it runs on.";

export default function Home() {
  const [where, setWhere] = useState<Where>("all");

  // The caption's tally is counted off the table, never typed. A caption that
  // says "5" over four rows is worse than no caption at all.
  const shown = OPS.filter((o) => where === "all" || o.where === where);
  const caption =
    where === "all"
      ? CAPTION_BASE
      : where === "local"
        ? `${shown.length} of ${OPS.length} things happen on your own computer.`
        : `${shown.length} of ${OPS.length} things reach a server — and only once you sign in.`;

  // Cursor spotlight — scoped to the hero, never page-wide, and only where
  // there's a real pointer to follow.
  const spotlight = (e: React.PointerEvent<HTMLElement>) => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <>
      <main id="main" className="home">
        {/* The headline sells the four things people actually come here to do,
            in the order they do them, and the highlighter band lands on the
            one that is hardest to do elsewhere without uploading. The marker
            is this product's own vocabulary: it is an annotation tool. */}
        <header className="hero" id="hero" onPointerMove={spotlight}>
          <div className="hero__spotlight" aria-hidden="true" />

          <div className="hero__grid">
            <div className="hero__lead">
              <p className="hero__eyebrow">Free image editor · runs in your browser</p>
              <h1 className="hero__display">
                Circle it. Crop it. <mark className="mark">Shrink it.</mark> Send it.
              </h1>
            </div>
            <div className="hero__aside">
              <p className="hero__deck">
                The quick way to mark up a screenshot, blur out what shouldn&rsquo;t be there, and
                get forty photos down to size &mdash; no account, and your pictures never leave this
                tab.
              </p>
              <div className="hero__actions">
                <a className="cta cta--fill" href={EDITOR_URL} {...external}>
                  Open an image
                </a>
                <a className="cta cta--outline" href="#made-for">
                  What can it do?
                </a>
              </div>
              <p className="hero__trust">
                <span>$0, forever</span>
                <span>No signup</span>
                <span>Works offline</span>
                <span>Nothing uploads</span>
              </p>
            </div>
          </div>

          {/* A real browser capture, not a redrawn frame. It is still the LCP
              and still loads eagerly; the rail underneath only reaches for an
              older frame once someone drags it. */}
          <ShotTimeline shots={SHOTS} />
        </header>

        {/* ── Cream ── Who it is for, before what it contains. */}
        <section className="board board--cream" id="made-for">
          <header className="board__head">
            <h2 className="board__title">Made for the jobs in between.</h2>
            <p className="board__deck">
              Not a darkroom. Not a design suite. Image Horse is for the five-minute picture job
              that keeps landing on your desk &mdash; and three people it keeps landing on.
            </p>
          </header>

          <ol className="made">
            {AUDIENCES.map((a) => (
              <li className="made__item" key={a.n}>
                <span className="made__eyebrow">
                  {a.n} &mdash; {a.who}
                </span>
                <h3 className="made__title">{a.title}</h3>
                <p className="made__body">{a.body}</p>
                <div className="made__tags">
                  {a.tags.map((t) => (
                    <span className="made__tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* The tool run, beside tiles that can actually be pressed. A picture
            of an interface asks to be taken on trust; these do not. */}
        <section className="editor" id="editor">
          <div className="editor__shot">
            <ButtonSet />
          </div>
          <div className="editor__text">
            <h2 className="section__title section__title--sm">
              Every tool you&rsquo;d reach for. None you&rsquo;d have to learn.
            </h2>
            <p className="editor__run">
              Crop · Resize · Brightness and contrast · Twelve presets · Blur · Arrows, boxes and
              pins · Text bubbles in three typefaces · Emoji · Blur, pixelate and black-box
              redaction · Magic-wand select · Magic eraser · Layers · Undo to a thousand steps ·
              Batch logo stamping · Export to PNG, JPEG, WebP or AVIF
            </p>
            <p className="lede editor__lede">
              All of it is free and works offline. Your edits are kept in this browser between
              visits; sign in only if you want them on another machine, a share link, or the AI
              tools &mdash; the padlock in the rail tells you which is which.
            </p>
          </div>
        </section>

        {/* ── Cream ── The claim, with its receipts attached. */}
        <section className="board board--cream" id="runs">
          <header className="board__head">
            <h2 className="board__title">Your photos stay on your computer.</h2>
            <p className="board__deck">
              Most online editors upload your picture the moment you open it. Image Horse does the
              work inside the tab instead. A few features do need a server &mdash; this is exactly
              which ones, so you never have to guess.
            </p>
          </header>

          {/* Filters the table rather than dimming it: this is a lookup, not an
              argument about what is still there. */}
          <div className="runs__filter" role="group" aria-label="Filter operations by where they run">
            {FILTERS.map(({ key, label, Icon }) => {
              const n = key === "all" ? OPS.length : OPS.filter((o) => o.where === key).length;
              return (
                <button
                  key={key}
                  className={`runs__tile${where === key ? " is-on" : ""}`}
                  type="button"
                  aria-pressed={where === key}
                  onClick={() => setWhere(key)}
                >
                  <Icon className="runs__tile-icon" />
                  <span className="runs__tile-label">{label}</span>
                  <span className="runs__tile-count">
                    {n} {n === 1 ? "thing" : "things"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="runs__scroll">
            <table className="runs__table">
              <caption className="runs__caption">{caption}</caption>
              <thead>
                <tr>
                  <th scope="col">What you&rsquo;re doing</th>
                  <th scope="col">Where it happens</th>
                  <th scope="col">In plain terms</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o, i) => (
                  <tr key={i}>
                    <th scope="row">{o.op}</th>
                    <td>
                      <span className={`runs__tag runs__tag--${o.where}`}>
                        {o.where === "local" ? "Your computer" : "A server, signed in"}
                      </span>
                    </td>
                    <td className="runs__detail">{o.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="runs__note">
            The whole editor is about <span className="fig">350&nbsp;KB</span> to download &mdash;
            smaller than most of the photos you&rsquo;ll open in it. After that, your computer does
            the work.
          </p>
        </section>

        {/* The one measurement on this page that has not shipped yet.
            ⚠️ The copy deliberately does NOT say "blur runs on your GPU". No
            pixel in the app goes near the GPU yet — the flag attaches a
            correctness harness and nothing more. The section sells the
            measurement, which is real, and the cubes are the honest demo: they
            ARE drawn by WebGPU where the machine has it. */}
        <section className="gpu" id="gpu" aria-labelledby="gpu-title">
          <div className="gpu__text">
            <h2 id="gpu-title" className="section__title section__title--sm">
              And it&rsquo;s about to get 17× faster.
            </h2>
            <p className="lede">
              We ran the same blur on your graphics card and on your processor. The card won every
              time &mdash; <span className="fig">5.3×</span> on a small image,{" "}
              <span className="fig">17.6×</span> at full size, <span className="fig">53.8×</span>{" "}
              once the blur gets wide.
            </p>
            <p className="gpu__caveat">
              It isn&rsquo;t switched on in the editor yet &mdash; it&rsquo;s still being checked
              pixel for pixel against the current engine. When it lands, nothing about your workflow
              changes. It just finishes sooner.
            </p>
            <p className="gpu__hint">The letters are live. Drag them, or press a key.</p>
          </div>

          <CubeLetters />
        </section>

        {/* Text only, deliberately. The v2 design put each post's share card
            above it, which made the section the heaviest thing on the page and
            the one least about the editor. The same `.postcard` as /blog, so the
            two surfaces are the same object at two sizes. */}
        {POSTS.length > 0 && (
          <section className="notes" id="notes" aria-labelledby="blog-title">
            <header className="head-hang">
              <h2 id="blog-title" className="section__title section__title--sm">
                From the blog
              </h2>
              <p className="lede">
                The Trail Log says what shipped. These are the decisions that needed the argument
                written out.
              </p>
            </header>

            <ol className="postlist__list">
              {POSTS.slice(0, 3).map((post) => (
                <li className="postcard" key={post.slug}>
                  <div className="postcard__meta">
                    <time className="postcard__date" dateTime={post.published}>
                      {fmtPostDate(post.published)}
                    </time>
                    {post.version && <span className="postcard__version">{post.version}</span>}
                  </div>
                  <div className="postcard__body">
                    <h3 className="postcard__title">
                      <Link to={postPath(post)}>{post.headline}</Link>
                    </h3>
                    <p className="postcard__deck">{post.deck}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="notes__more">
              <Link to="/blog">
                All posts <span aria-hidden="true">&rarr;</span>
              </Link>
            </p>
          </section>
        )}

        {/* ── Cream ── The ask. */}
        <section className="board board--cream board--close">
          <div className="closing">
            <p className="closing__line">Open an image. That&rsquo;s the whole signup.</p>
            <p className="closing__sub">
              No account to make, nothing to install, nothing uploaded. If you decide you want your
              edits on another machine later, that&rsquo;s the moment to sign in &mdash; not before.
            </p>
          </div>
          <div className="closing__actions">
            <a className="cta cta--ink cta--lg" href={EDITOR_URL} {...external}>
              Open the editor &mdash; free
            </a>
            <a className="cta cta--ink-outline cta--lg" href={GITHUB_URL} {...external}>
              Read the source
            </a>
            <p className="closing__licence">MIT licensed · open source</p>
          </div>
        </section>
      </main>

      <Footer line="Your pictures, your computer. The cloud only when you ask." />
    </>
  );
}
