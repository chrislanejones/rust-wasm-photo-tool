import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import { CODEBERG_URL, EDITOR_URL, GITHUB_URL, external } from "../config";

/* /contact — where each kind of message goes.
 *
 * No form. A form needs something on the other end to receive it, and this
 * site is static files with nothing behind them. The address below is the one
 * the Privacy Policy and the Terms already publish, so this page adds a door,
 * not a new inbox.
 *
 * Reuses `.post` for the body, as the legal pages do: it is the site's prose
 * block, so this page needs no CSS of its own.
 */

const EMAIL = "chrislanejones@gmail.com";

export default function Contact() {
  return (
    <>
      <main id="main">
        <header className="page-head">
          <h1 className="page-head__title">Contact</h1>
          <p className="lede">
            Image Horse is one person&rsquo;s project, so every message here reaches the person
            who wrote the code.
          </p>
        </header>

        <article className="post">
          <h2>Email</h2>
          <p>
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. Questions, feedback, a tool you wish it had:
            all of it can go here.
          </p>

          <h2>Bugs and feature requests</h2>
          <p>
            Open an issue on{" "}
            <a href={`${GITHUB_URL}/issues`} {...external}>
              GitHub
            </a>
            , or on{" "}
            <a href={`${CODEBERG_URL}/issues`} {...external}>
              Codeberg
            </a>{" "}
            if you would rather not use GitHub. A screenshot and the name of your browser make a
            bug much quicker to find. Issues are public, so leave out anything private.
          </p>

          <h2>Security</h2>
          <p>
            If you have found a way to reach something you should not be able to, email it
            instead of opening an issue, so it can be fixed before it is public.
          </p>

          <h2>Your account and your data</h2>
          <p>
            Without an account, your photos and edits live in your browser and never reach me. If
            you made an account, email from the address you signed in with to have it deleted,
            along with everything stored with it. The <Link to="/privacy-policy">Privacy Policy</Link>{" "}
            lists what that is.
          </p>

          <h2>Elsewhere</h2>
          <p>
            The rest of what I build is at{" "}
            <a href="https://www.chrislanejones.com" {...external}>
              chrislanejones.com
            </a>
            .
          </p>
        </article>

        <section className="close">
          <div className="close__body">
            <p className="close__line">Or skip the email and try it.</p>
            <p className="close__sub">No account, no upload, nothing to sign.</p>
            <div className="close__actions">
              <a className="cta cta--fill cta--lg" href={EDITOR_URL} {...external}>
                Open the beta
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer line="One inbox, and the same person who wrote the code." />
    </>
  );
}
