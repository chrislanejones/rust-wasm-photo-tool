import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import { EDITOR_URL, GITHUB_URL, external } from "../config";

/* /terms-of-service — the terms, in the same plain register as the rest of the
 * site.
 *
 * Kept honest about two things the software actually is: it is beta, and it is
 * local-first. The second one is why the content clause is short — we cannot
 * grant ourselves a license to pictures we never receive, and saying otherwise
 * to look thorough would contradict the privacy policy next door.
 *
 * Layout is the Terms v2 mockup (legal.css). The wording is the terms as they
 * were before the redesign, clause for clause; see PrivacyPolicy.tsx for why.
 * The headline and deck are the old lede split in two. The mockup's own deck
 * said "your pictures never reach us", which the "Your pictures are yours"
 * clause below does not claim — it names the cloud and AI exceptions — so it
 * was not used. */
export default function TermsOfService() {
  return (
    <>
      <main id="main">
        <header className="legal-head">
          <div className="legal-head__lead">
            <p className="legal-head__eyebrow">
              Terms of Service &middot; updated <time dateTime="2026-09-20">09-20-2026</time>
            </p>
            <h1 className="legal-head__title">Short, because the software asks little of you.</h1>
          </div>
          <p className="legal-head__deck">
            It is beta, it is free, and your pictures stay yours. The paid tier bills monthly and
            you can stop it whenever you like.
          </p>
        </header>

        <div className="legal-summary">
          <div className="legal-summary__card legal-summary__card--lit">
            <p className="legal-summary__label">It is beta</p>
            <p className="legal-summary__text">
              Image Horse is in beta and is provided as is, with no warranty. Do not use it as the
              only place a picture exists.
            </p>
          </div>
          <div className="legal-summary__card">
            <p className="legal-summary__label">Your pictures are yours</p>
            <p className="legal-summary__text">
              You keep every right you have in what you open, edit and export. We claim nothing.
            </p>
          </div>
        </div>

        <article className="legal-board">
          <section className="legal-board__section">
            <h2>Using Image Horse</h2>
            <p>
              Image Horse is a photo editor that runs in your browser at{" "}
              <a href={EDITOR_URL} {...external}>
                edit.imagehorse.app
              </a>
              . Using it means you accept these terms. If you do not, do not use it.
            </p>
            <p>
              You must be 13 or older. If you use it for work, you accept these terms on behalf of
              whoever you work for.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>It is beta software</h2>
            <p>
              <strong>Image Horse is in beta and is provided as is, with no warranty.</strong> It
              may have bugs, it may lose work, and features may change or disappear. Do not use it
              as the only place a picture exists.
            </p>
            <p>
              Your gallery lives in your own browser&rsquo;s storage and is not backed up by us. We
              cannot recover it. Export anything you would be upset to lose.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>Your pictures are yours</h2>
            <p>
              You keep every right you have in what you open, edit and export. We claim nothing.
              Because the editing runs on your machine, we do not receive your pictures at all, so
              there is no license for us to ask for.
            </p>
            <p>
              The exceptions are the ones named in the{" "}
              <Link to="/privacy-policy">Privacy Policy</Link>: the cloud features you use while
              signed in, and the AI tools, which are off by default. Turning those on sends the
              material they need to a server so the feature can run, and for no other purpose.
            </p>
          </section>

          <section className="legal-board__section legal-board__section--list">
            <h2>What you agree not to do</h2>
            <ul className="legal-board__cards">
              <li className="legal-board__card">
                Break the law with it, or use it on material you have no right to use.
              </li>
              <li className="legal-board__card">
                Make images that sexualize children, impersonate someone to deceive, or harass a
                person.
              </li>
              <li className="legal-board__card">
                Attack the service — overload it, break into it, or work around its limits.
              </li>
              <li className="legal-board__card">
                Resell access to the paid features as if they were yours.
              </li>
            </ul>
            <p>
              We may suspend or close an account that does these things. Since the editor runs
              without an account, that remedy reaches the paid and cloud features rather than the
              software itself.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>Accounts</h2>
            <p>
              You do not need an account. If you make one, keep control of it — anything done
              through it is treated as done by you. Ask us to delete it at any time and we will
              delete it and what is stored with it.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>Paid plans</h2>
            <p>
              The free tier is free and stays useful. The paid tier bills monthly in advance through
              Stripe, which handles the payment; we never see your card details. Prices are on the{" "}
              <Link to="/pricing">Pricing</Link> page and can change, with notice before a change
              reaches a renewal.
            </p>
            <p>
              Cancel whenever you like. Your plan then runs to the end of the period you have paid
              for and does not renew. Part-months are not refunded, but if the service was broken
              or you were billed in error, write to us and we will sort it out.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>The source code</h2>
            <p>
              Image Horse is open source under the MIT license and the repository is{" "}
              <a href={GITHUB_URL} {...external}>
                public
              </a>
              . That license covers the code. It is not a license to the hosted service, the name
              or the horse.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>Availability</h2>
            <p>
              We do not promise the hosted service will be up. We may change it, pause it or retire
              it. Because the editor runs locally and the source is public, a shutdown does not
              strand you the way a purely hosted tool would.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>Liability</h2>
            <p>
              To the extent the law allows, we are not liable for lost work, lost data, lost
              profits or any indirect damages. Where liability cannot be excluded, it is limited to
              what you paid us in the twelve months before the claim — which, on the free tier, is
              nothing.
            </p>
            <p>Nothing here removes a right you have that cannot be waived.</p>
          </section>

          <section className="legal-board__minor legal-board__minor--wide">
            <div>
              <h2>Changes to these terms</h2>
              <p>
                When these terms change the date at the top of the page changes with it, and the
                whole history is readable in the public repository. Continuing to use Image Horse
                after a change means you accept it.
              </p>
            </div>
            <div>
              <h2>Contact</h2>
              <p>
                Anything about these terms:{" "}
                <a href="mailto:chrislanejones@gmail.com">chrislanejones@gmail.com</a>, or the{" "}
                <a href={`${GITHUB_URL}/issues`} {...external}>
                  issue tracker
                </a>
                .
              </p>
            </div>
          </section>
        </article>

        <section className="legal-close">
          <div className="legal-close__text">
            <p className="legal-close__line">Free, and it asks for nothing.</p>
            <p className="legal-close__sub">No account, no upload, no card.</p>
          </div>
          <a className="cta cta--fill legal-close__cta" href={EDITOR_URL} {...external}>
            Open the editor
          </a>
        </section>
      </main>

      <Footer line="Your pictures are yours. This page just says so." />
    </>
  );
}
