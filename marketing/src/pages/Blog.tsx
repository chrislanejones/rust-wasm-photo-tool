import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import { POSTS, fmtPostDate, postPath } from "../data/posts";
import { EDITOR_URL, external } from "../config";

/* /blog — the list.
 *
 * Laid out on the Trail Log's grid rather than as a card deck: a dated meta
 * column on the left, the writing on the right. That is not a style choice
 * being reused for its own sake — the two pages answer the same question in two
 * registers ("what changed" and "why"), and a reader who has scrolled one
 * should not have to learn a second layout to scan the other.
 *
 * Deliberately no tag filter yet. The site has a segmented filter on three
 * pages and it would drop straight in, but a control that narrows one post to
 * one post is furniture. It goes in when the list is long enough to need it.
 */
export default function Blog() {
  const [latest, ...rest] = POSTS;

  return (
    <>
      <main id="main">
        <header className="page-head">
          <h1 className="page-head__title">Blog</h1>
          <p className="lede">
            Notes on how this thing is built. Each post takes one decision, says what it cost, and
            shows the measurements behind it. The changelog is on the{" "}
            <Link to="/trail-log">Trail Log</Link> — this is the part that needed more than a line.
          </p>
        </header>

        <section className="postlist" aria-label="All posts">
          <p className="postlist__count">
            {POSTS.length === 1 ? "1 post" : `${POSTS.length} posts`}, newest first.
          </p>

          <ol className="postlist__list">
            {POSTS.map((post) => (
              <li className="postcard" key={post.slug}>
                <div className="postcard__meta">
                  {/* ISO in the attribute, prose in the text — the machine form
                      and the human form of one date, never two dates. */}
                  <time className="postcard__date" dateTime={post.published}>
                    {fmtPostDate(post.published)}
                  </time>
                  {post.version && <span className="postcard__version">{post.version}</span>}
                  {post === latest && rest.length > 0 && (
                    <span className="postcard__latest">Latest</span>
                  )}
                </div>

                <div className="postcard__body">
                  <h2 className="postcard__title">
                    {/* The whole heading is the link. A "Read more" beneath a
                        title that is also a link gives one destination two
                        targets and makes a screen reader announce it twice. */}
                    <Link to={postPath(post)}>{post.headline}</Link>
                  </h2>
                  <p className="postcard__deck">{post.deck}</p>
                  <p className="postcard__tags">
                    <span className="tag">{post.tag}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="close">
          <div className="close__body">
            <p className="close__line">The software these are about is free to try.</p>
            <p className="close__sub">
              Everything described here runs in your own tab. There is no account to make and nothing
              is uploaded — open an image and the engine is already on your machine.
            </p>
            <div className="close__actions">
              <a className="cta cta--fill cta--lg" href={EDITOR_URL} {...external}>
                Open the beta
              </a>
              <Link className="cta cta--outline cta--lg" to="/architecture">
                See how it fits together
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer line="The changelog says what. This says why." />
    </>
  );
}
