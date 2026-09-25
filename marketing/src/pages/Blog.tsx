import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import { POSTS, fmtPostDate, postPath } from "../data/posts";
import { EDITOR_URL, external } from "../config";

/* /blog — the list, v2.
 *
 * Laid out on the Trail Log's grid rather than as a card deck: a dated meta
 * column on the left, the writing on the right. The two pages answer the same
 * question in two registers ("what changed" and "why"), so a reader who has
 * scrolled one should not have to learn a second layout to scan the other.
 *
 * Own `blog-*` classes rather than the shared `.postcard`: Home's "From the
 * blog" uses `.postcard` and is deliberately text-only, and this page's v2 row
 * sets its headline much larger. Two sizes of one object, two class sets.
 *
 * The design also showed "3 figures · 12 min" under each post. A Post has no
 * figure count or reading time, so that pill is left out rather than guessed.
 */
export default function Blog() {
  const [latest, ...rest] = POSTS;
  const count = POSTS.length === 1 ? "1 post" : `${POSTS.length} posts`;

  return (
    <>
      <main id="main">
        <header className="blog-head">
          <div className="blog-head__lead">
            <p className="blog-head__eyebrow">Blog &middot; {count}, newest first</p>
            <h1 className="blog-head__title">The changelog says what. This says why.</h1>
          </div>
          <p className="blog-head__deck">
            Notes on how this thing is built. Each post takes one decision, says what it cost, and
            shows the measurements behind it. The line-by-line version is on the{" "}
            <Link to="/trail-log">Trail Log</Link> &mdash; this is the part that needed more than a
            line.
          </p>
        </header>

        <section className="blog-list" aria-label="All posts">
          <ol className="blog-list__items">
            {POSTS.map((post) => (
              <li className="blog-row" key={post.slug}>
                <div className="blog-row__meta">
                  {/* ISO in the attribute, prose in the text — one date, two forms. */}
                  <time className="blog-row__date" dateTime={post.published}>
                    {fmtPostDate(post.published)}
                  </time>
                  {post.version && <span className="blog-row__version">{post.version}</span>}
                  {post === latest && rest.length > 0 && (
                    <span className="blog-row__latest">Latest</span>
                  )}
                </div>

                <div className="blog-row__body">
                  <h2 className="blog-row__title">
                    {/* The whole heading is the link — no separate "Read more". */}
                    <Link to={postPath(post)}>{post.headline}</Link>
                  </h2>
                  <p className="blog-row__deck">{post.deck}</p>
                  <p className="blog-row__tags">
                    <span className="blog-pill">{post.tag}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="blog-close">
          <div className="blog-close__copy">
            <p className="blog-close__line">The software these are about is free to try.</p>
            <p className="blog-close__sub">
              Everything described here runs in your own tab. There is no account to make and nothing
              is uploaded &mdash; open an image and the engine is already on your machine.
            </p>
          </div>
          <div className="blog-close__actions">
            <a className="blog-btn blog-btn--fill" href={EDITOR_URL} {...external}>
              Open the editor &mdash; free
            </a>
            <Link className="blog-btn blog-btn--line" to="/architecture">
              See how it fits together
            </Link>
          </div>
        </section>
      </main>

      <Footer line="The changelog says what. This says why." />
    </>
  );
}
