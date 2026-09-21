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
 * Reuses `.post` for the body: it is the site's prose block (measure, rhythm,
 * link and heading styles) and is not blog-specific, so a legal page needs no
 * CSS of its own.
 */
export default function PrivacyPolicy() {
  return (
    <>
      <main id="main">
        <header className="page-head">
          <h1 className="page-head__title">Privacy Policy</h1>
          <p className="lede">
            Editing happens on your machine. This page is about the exceptions, and there are only
            a few of them.
          </p>
          <p className="lede">
            Last updated <time dateTime="2026-09-20">09-20-2026</time>.
          </p>
        </header>

        <article className="post">
          <h2>The short version</h2>
          <p>
            Image Horse opens your photos in your browser and edits them there. The image engine is
            Rust compiled to WebAssembly and it runs on your own processor, so the pictures you open
            are not uploaded to edit them, resize them, compress them or annotate them. You do not
            need an account to use it.
          </p>
          <p>
            Four things do leave your device, and each one is listed below: anonymous usage
            analytics, your account details if you make an account, the cloud features that only run
            when you are signed in, and the AI tools, which are off until you switch them on.
          </p>

          <h2>What stays on your device</h2>
          <p>
            Your photos, your edits, your layers and your gallery are stored in your browser&rsquo;s
            own database (IndexedDB) on the machine you are using. We do not receive them and we
            cannot read them. They are not backed up anywhere. If you clear your browser&rsquo;s
            site data for Image Horse, that copy is gone and we have no way to restore it, so export
            anything you want to keep.
          </p>
          <p>
            Because this storage belongs to the browser and the address, a gallery saved on one
            browser or one device does not appear on another.
          </p>

          <h2>Analytics</h2>
          <p>
            <strong>Both the website and the editor run Google Analytics 4</strong>, and it runs for
            everyone — there is no switch for it and we do not ask first. It sets cookies and it
            contacts Google on every page load. It records pages viewed, rough location derived from
            the network address, and general device and browser details. It does not receive your
            photos or anything you type into the editor. The website and the editor are separate
            properties.
          </p>
          <p>
            The editor also runs Vercel Web Analytics, which counts page views without cookies and
            without identifying you.
          </p>

          <h2>Accounts</h2>
          <p>
            Accounts are optional and the editor works fully without one. If you do make an account,
            it is handled by Clerk, which stores your email address, your name and picture if you
            provide them, and the identity from whichever provider you signed in with. If you sign
            in with Google or GitHub we receive your email address, name and avatar from them, and
            nothing else — we never see your password with either.
          </p>

          <h2>Cloud features, when you are signed in</h2>
          <p>
            Signing in enables features that need a server: share links, syncing your settings
            across devices, and keeping edit history off-device. These run on Convex. What is
            stored there is the material those features need — the document you chose to share or
            sync, and the account it belongs to. Signed out, none of it runs.
          </p>
          <p>
            The settings sync is named in full because it is the one that happens without you
            asking each time. Three things travel: your preferences (the Settings dialog), which
            panels and tabs you last had open along with the command palette's recent list, and
            which mode each tool was left in. That is the whole list. Your photos, your edits and
            your gallery are not in it — they stay in this browser, on this device, exactly as they
            do signed out. Settings &rsaquo; General shows what sync is doing and has a button that
            deletes the synced copy from your account.
          </p>

          <h2>The AI tools</h2>
          <p>
            <strong>These are off by default and they are the only part of the editor that sends a
            picture to a server.</strong> The New dialog has a switch for online features; while it
            is off, the AI tools are not offered. When you turn it on and use one, the prompt you
            wrote and the image or mask you are working on are sent to our server and processed by
            Replicate, which runs the model. They are used to produce your result and are not used
            to train anything by us.
          </p>

          <h2>Payment</h2>
          <p>
            The paid tier is billed by Stripe. Stripe handles the card details and we never see
            them. We keep the subscription status Stripe reports so the app knows which tier your
            account is on.
          </p>

          <h2>What you can switch off</h2>
          <ul>
            <li>
              Use the editor signed out. Everything except the cloud and AI features works, and
              nothing is tied to a person.
            </li>
            <li>
              Leave online features off. That is the shipped default, and it keeps every picture in
              the tab.
            </li>
            <li>
              Strip metadata on export. Settings &rsaquo; Security removes EXIF, GPS, XMP and IPTC
              from what you save, or removes only the location and keeps the camera details.
            </li>
            <li>
              Clear your site data to delete the local gallery, or block cookies for this site to
              stop the analytics cookies.
            </li>
          </ul>

          <h2>Children</h2>
          <p>
            Image Horse is not directed at children under 13 and we do not knowingly collect their
            information.
          </p>

          <h2>Changes</h2>
          <p>
            When this policy changes the date at the top of the page changes with it. The page is in
            the same public repository as the software, so its whole history is readable there.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about any of this, or a request to delete an account and what is stored with
            it, can go to <a href="mailto:chrislanejones@gmail.com">chrislanejones@gmail.com</a> or
            to the{" "}
            <a href={`${GITHUB_URL}/issues`} {...external}>
              issue tracker
            </a>
            .
          </p>
        </article>

        <section className="close">
          <div className="close__body">
            <p className="close__line">The editor is free and needs no account.</p>
            <p className="close__sub">
              It runs on your own machine. Nothing you open is uploaded to edit it.
            </p>
            <div className="close__actions">
              <a className="cta cta--fill cta--lg" href={EDITOR_URL} {...external}>
                Open the beta
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer line="Your pictures stay where you put them." />
    </>
  );
}
