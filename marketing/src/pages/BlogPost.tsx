import { Link, useParams } from "react-router-dom";
import Footer from "../components/Footer";
import NextCards from "../components/NextCards";
import NotFound from "./NotFound";
import { pickNextCardsForPost } from "../data/nextCards";
import { fmtPostDate, postFor, postPath } from "../data/posts";
import { POST_BODIES, POST_TOPPERS } from "../posts/registry";
import { AUTHOR } from "../seo";

/* /blog/:slug — the article shell.
 *
 * The shell owns everything around the writing: the way back, the headline, the
 * dateline, what to read next, and the footer. The post owns the words, and
 * optionally a header banner — the picture behind the headline, never the
 * headline itself. That split is what keeps a post file to prose and figures
 * with no page furniture in it, and it means a change to the dateline is one
 * edit rather than one per post.
 *
 * Layout is the v2 post design ("Blog - Offline by Construction" / "Blog -
 * Engine in a Worker"): a tall topper with the headline set at its foot, then
 * one centered reading column with wider figures. Its CSS is blog-post.css,
 * scoped under `.post-head--article` and `.post--article`, because `.post` is
 * also the prose block for Contact and the legal pages.
 */

/* The line above the footer, per post, from each post's design. A post without
   one gets the generic line. */
const FOOTER_LINE: Record<string, string> = {
  "offline-by-construction": "Offline isn't a feature. It's what's left when nothing was on the wire.",
  "engine-in-a-worker": "The engine left the main thread. The pixels stayed put.",
};
const DEFAULT_FOOTER_LINE = "Written down so the next decision has something to argue with.";

const Sep = () => (
  <span className="post-head__sep" aria-hidden="true">
    ·
  </span>
);

export default function BlogPost() {
  const { slug = "" } = useParams();
  const post = postFor(slug);

  // An unknown slug is a 404, not a blank article. Rendering NotFound rather
  // than redirecting keeps the wrong URL in the address bar, which is what the
  // reader needs to see, and `useHead` drops the canonical for the same path —
  // a canonical here would tell a crawler this junk URL is a real page.
  if (!post) return <NotFound />;

  const Body = POST_BODIES[post.slug];
  const Topper = POST_TOPPERS[post.slug];

  // The foot was an Older/Newer pair walking POSTS in order. With two posts
  // that is one link and a dead end, and it could only ever offer more blog —
  // never the tool the post is about. It is now the site's four-card grid,
  // led by another post so the writing still comes first.
  const cards = pickNextCardsForPost(postPath(post));

  return (
    <>
      <main id="main">
        <header
          className={`post-head post-head--article${Topper ? " post-head--topper" : ""}`}
        >
          {Topper ? (
            <>
              {/* The post's own scene, then a scrim that darkens the top for
                  the nav and the foot for the headline. Both decorative. */}
              <div className="post-head__scene" aria-hidden="true">
                <Topper />
              </div>
              <div className="post-head__scrim" aria-hidden="true" />
            </>
          ) : (
            <div className="post-head__bloom" aria-hidden="true" />
          )}

          <p className="post-head__meta">
            {/* A real link up to the index, not a browser-history "back" — this
                page is reachable from a search result, where there is nothing
                behind it to go back to. */}
            <Link className="post-head__up" to="/blog">
              Blog
            </Link>
            <Sep />
            <span>{post.tag}</span>
            <Sep />
            <time dateTime={post.published}>{fmtPostDate(post.published)}</time>
            <Sep />
            <span>{AUTHOR.name}</span>
            {post.updated && (
              <>
                <Sep />
                {/* Only ever shown when the post declares a real revision. */}
                <span className="post-head__updated">
                  updated <time dateTime={post.updated}>{fmtPostDate(post.updated)}</time>
                </span>
              </>
            )}
          </p>

          <h1 className="post-head__title">{post.headline}</h1>
          <p className="post-head__deck">{post.deck}</p>
        </header>

        <article className="post post--article">
          <Body />
        </article>

        <NextCards cards={cards} heading="Read next" label="More to read" />

      </main>

      <Footer line={FOOTER_LINE[post.slug] ?? DEFAULT_FOOTER_LINE} />
    </>
  );
}
