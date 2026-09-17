import { Link, useParams } from "react-router-dom";
import Footer from "../components/Footer";
import NotFound from "./NotFound";
import { POSTS, fmtPostDate, postFor, postPath } from "../data/posts";
import { POST_BODIES } from "../posts/registry";
import { AUTHOR } from "../seo";
import { EDITOR_URL, external } from "../config";

/* /blog/:slug — the article shell.
 *
 * The shell owns everything around the writing: the way back, the headline, the
 * dateline, what to read next, and the footer. The post owns the words. That
 * split is what keeps a post file to prose and figures with no page furniture
 * in it, and it means a change to the dateline is one edit rather than one per
 * post.
 */
export default function BlogPost() {
  const { slug = "" } = useParams();
  const post = postFor(slug);

  // An unknown slug is a 404, not a blank article. Rendering NotFound rather
  // than redirecting keeps the wrong URL in the address bar, which is what the
  // reader needs to see, and `useHead` drops the canonical for the same path —
  // a canonical here would tell a crawler this junk URL is a real page.
  if (!post) return <NotFound />;

  const Body = POST_BODIES[post.slug];

  // POSTS is newest first, so the entry before this one is the newer post.
  const i = POSTS.indexOf(post);
  const newer = i > 0 ? POSTS[i - 1] : undefined;
  const older = i < POSTS.length - 1 ? POSTS[i + 1] : undefined;

  return (
    <>
      <main id="main">
        <header className="post-head">
          <div className="post-head__bloom" aria-hidden="true" />

          {/* A real link up to the index, not a browser-history "back" — this
              page is reachable from a search result, where there is nothing
              behind it to go back to. */}
          <p className="post-head__up">
            <Link to="/blog">Blog</Link>
          </p>

          <h1 className="post-head__title">{post.headline}</h1>
          <p className="post-head__deck">{post.deck}</p>

          <p className="post-head__meta">
            <time dateTime={post.published}>{fmtPostDate(post.published)}</time>
            {post.version && (
              <>
                <span className="post-head__sep" aria-hidden="true">
                  ·
                </span>
                <span className="post-head__version">{post.version}</span>
              </>
            )}
            <span className="post-head__sep" aria-hidden="true">
              ·
            </span>
            <span>{AUTHOR.name}</span>
            {post.updated && (
              <>
                <span className="post-head__sep" aria-hidden="true">
                  ·
                </span>
                {/* Only ever shown when the post declares a real revision. */}
                <span className="post-head__updated">
                  updated <time dateTime={post.updated}>{fmtPostDate(post.updated)}</time>
                </span>
              </>
            )}
          </p>
        </header>

        <article className="post">
          <Body />
        </article>

        {(newer || older) && (
          <nav className="post-next" aria-label="More posts">
            {older && (
              <Link className="post-next__link" to={postPath(older)}>
                <span className="post-next__label">Older</span>
                <span className="post-next__title">{older.headline}</span>
              </Link>
            )}
            {newer && (
              <Link className="post-next__link post-next__link--newer" to={postPath(newer)}>
                <span className="post-next__label">Newer</span>
                <span className="post-next__title">{newer.headline}</span>
              </Link>
            )}
          </nav>
        )}

        <section className="close">
          <div className="close__body">
            <p className="close__line">All of this is running in the demo right now.</p>
            <p className="close__sub">
              No account, no upload. Open an image and the engine described above is already on your
              own machine — including the worker this post is about.
            </p>
            <div className="close__actions">
              <a className="cta cta--fill cta--lg" href={EDITOR_URL} {...external}>
                Open the demo
              </a>
              <Link className="cta cta--outline cta--lg" to="/blog">
                Read the rest
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer line="Written down so the next decision has something to argue with." />
    </>
  );
}
