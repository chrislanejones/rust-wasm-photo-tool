import Footer from "../components/Footer";
import { EDITOR_URL, GITHUB_URL, external } from "../config";

/* /privacy-policy — what leaves your machine, named one thing at a time.
 *
 * Written against the code, not from a template. Every claim below has a file
 * behind it: the local-first parts are `lib/dexie/*` and the engine, and each
 * exception is a real dependency in `app/package.json` or `convex/`.
 *
 * ⚠️ The analytics paragraph is the one a boilerplate policy gets wrong. GA4 is
 * UNGATED on both hosts and sets cookies — `lib/analytics.ts` says so in its own
 * header, including that this sits in tension with the site's "nothing leaves
 * your tab by accident" line. That tension belongs in the policy rather than
 * out of it, so it is stated plainly here.
 *
 * Layout is the Privacy v2 mockup (legal.css). The WORDING is not: every
 * sentence in the body is the policy as it was before the redesign. Where the
 * mockup reworded a clause, the old wording stayed and the difference went to
 * Chris to decide — a legal page does not change its meaning as a side effect
 * of a restyle. The two summary cards quote the body word for word for the
 * same reason. */
export default function PrivacyPolicy() {
  return (
    <>
      <main id="main">
        <header className="legal-head">
          <div className="legal-head__lead">
            <p className="legal-head__eyebrow">
              Privacy Policy &middot; updated <time dateTime="2026-09-22">09-22-2026</time>
            </p>
            <h1 className="legal-head__title">Four things leave your device. Here they are.</h1>
          </div>
          <p className="legal-head__deck">
            Editing happens on your machine. This page is about the exceptions, and there are only
            a few of them.
          </p>
        </header>

        <div className="legal-summary">
          <div className="legal-summary__card">
            <p className="legal-summary__label">Stays on your device</p>
            <p className="legal-summary__text">
              Your photos, your edits, your layers and your gallery are stored in your
              browser&rsquo;s own database (IndexedDB) on the machine you are using. We do not
              receive them and we cannot read them.
            </p>
          </div>
          <div className="legal-summary__card">
            <p className="legal-summary__label">Leaves your device</p>
            <p className="legal-summary__text">
              Anonymous usage analytics, your account details if you make an account, the cloud
              features that only run when you are signed in, and the AI tools, which are off until
              you switch them on.
            </p>
          </div>
        </div>

        <article className="legal-board">
          <section className="legal-board__section">
            <h2>The short version</h2>
            <p>
              Image Horse opens your photos in your browser and edits them there. The image engine
              is Rust compiled to WebAssembly and it runs on your own processor, so the pictures you
              open are not uploaded to edit them, resize them, compress them or annotate them. You
              do not need an account to use it.
            </p>
            <p>
              Four things do leave your device, and each one is listed below: anonymous usage
              analytics, your account details if you make an account, the cloud features that only
              run when you are signed in, and the AI tools, which are off until you switch them on.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>What stays on your device</h2>
            <p>
              Your photos, your edits, your layers and your gallery are stored in your
              browser&rsquo;s own database (IndexedDB) on the machine you are using. We do not
              receive them and we cannot read them. They are not backed up anywhere. If you clear
              your browser&rsquo;s site data for Image Horse, that copy is gone and we have no way
              to restore it, so export anything you want to keep.
            </p>
            <p>
              Because this storage belongs to the browser and the address, a gallery saved on one
              browser or one device does not appear on another.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>Analytics</h2>
            <p>
              <strong>Both the website and the editor run Google Analytics 4</strong>, and it runs
              for everyone — there is no switch for it and we do not ask first. It sets cookies and
              it contacts Google on every page load. It records pages viewed, rough location derived
              from the network address, and general device and browser details. It does not receive
              your photos or anything you type into the editor. The website and the editor are
              separate properties.
            </p>
            <p>
              The editor also runs Vercel Web Analytics, which counts page views without cookies
              and without identifying you.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>Accounts</h2>
            <p>
              Accounts are optional and the editor works fully without one. If you do make an
              account, it is handled by Clerk, which stores your email address, your name and
              picture if you provide them, and the identity from whichever provider you signed in
              with. If you sign in with Google or GitHub we receive your email address, name and
              avatar from them, and nothing else — we never see your password with either.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>Cloud features, when you are signed in</h2>
            <p>
              Signing in enables features that need a server: share links, syncing your settings
              across devices, and keeping edit history off-device. These run on Convex. What is
              stored there is the material those features need — the document you chose to share
              or sync, and the account it belongs to. Signed out, none of it runs.
            </p>
            <p>
              Keeping edit history off-device means a flattened copy of an edited photo, stored
              under your account so another device can pick it up. It is governed by the
              &ldquo;Everything in your browser&rdquo; switch, like the AI tools: with the switch
              off, no copy of a photo is uploaded, signed in or not. Deleting a copy you already
              uploaded works either way — that sends nothing, and it is how you take something
              back.
            </p>
            <p>
              A share link keeps the flattened image you shared, a count of how many times it was
              opened, and the time of each opening — the time only. Nothing about who opened it is
              recorded: no address, no browser, no account. Settings &rsaquo; Shared shows every
              link you have made with those counts, lets you stop a link after a number of views or
              on a date, pause and resume it, or delete it, which removes the image too.
            </p>
            <p>
              The settings sync is named in full because it is the one that happens without you
              asking each time. Three things travel: your preferences (the Settings dialog), which
              panels and tabs you last had open along with the command palette's recent list, and
              which mode each tool was left in. That is the whole list. The online-features switch
              is not on it, because agreeing to send data to a server is something you do on each
              device, and nothing that identifies your device or browser is sent along. Your
              photos, your edits and your gallery are not in it — they stay in this browser, on
              this device, exactly as they do signed out.
            </p>
            <p>
              Settings &rsaquo; Sync shows what sync is doing, on a phone too. It has a switch that
              turns sync off for that device alone: nothing is fetched or sent from it until you
              turn it back on. It also has a button that deletes the synced copy from your account.
              What is left afterwards is a note that each item was deleted and when, so your other
              devices do not send it straight back. Nothing is sent again until you change one of
              those settings, or press &ldquo;Send this device&rsquo;s settings&rdquo;, on a device
              where you are signed in.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>The AI tools</h2>
            <p>
              <strong>
                These are off by default and they are the only part of the editor that sends a
                picture to a server.
              </strong>{" "}
              The switch for online features is in the New dialog and in Settings &rsaquo;
              Security; while it is off, the AI tools are not offered. When you turn it on and use
              one, the prompt you wrote and the image or mask you are working on are sent to our
              server and processed by Replicate, which runs the model. They are used to produce your
              result and are not used to train anything by us.
            </p>
          </section>

          <section className="legal-board__section">
            <h2>Payment</h2>
            <p>
              The paid tier is billed by Stripe. Stripe handles the card details and we never see
              them. We keep the subscription status Stripe reports so the app knows which tier your
              account is on.
            </p>
          </section>

          <section className="legal-board__section legal-board__section--list">
            <h2>What you can switch off</h2>
            <ul className="legal-board__cards">
              <li className="legal-board__card">
                <strong>Use the editor signed out.</strong> Everything except the cloud and AI
                features works, and nothing is tied to a person.
              </li>
              <li className="legal-board__card">
                <strong>Leave online features off.</strong> That is the shipped default, and it
                keeps every picture in the tab.
              </li>
              <li className="legal-board__card">
                <strong>Strip metadata on export.</strong> Settings &rsaquo; Security removes EXIF,
                GPS, XMP and IPTC from what you save, or removes only the location and keeps the
                camera details.
              </li>
              <li className="legal-board__card">
                <strong>Clear your site data</strong> to delete the local gallery, or block cookies
                for this site to stop the analytics cookies.
              </li>
            </ul>
          </section>

          <section className="legal-board__minor">
            <div>
              <h2>Children</h2>
              <p>
                Image Horse is not directed at children under 13 and we do not knowingly collect
                their information.
              </p>
            </div>
            <div>
              <h2>Changes</h2>
              <p>
                When this policy changes the date at the top of the page changes with it. The page
                is in the same public repository as the software, so its whole history is readable
                there.
              </p>
            </div>
            <div>
              <h2>Contact</h2>
              <p>
                Questions about any of this, or a request to delete an account and what is stored
                with it, can go to{" "}
                <a href="mailto:chrislanejones@gmail.com">chrislanejones@gmail.com</a> or to the{" "}
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
            <p className="legal-close__line">The editor is free and needs no account.</p>
            <p className="legal-close__sub">
              It runs on your own machine. Nothing you open is uploaded to edit it.
            </p>
          </div>
          <a className="cta cta--fill legal-close__cta" href={EDITOR_URL} {...external}>
            Open the editor
          </a>
        </section>
      </main>

      <Footer line="Your pictures stay where you put them." />
    </>
  );
}
