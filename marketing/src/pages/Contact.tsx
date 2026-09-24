import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import { CODEBERG_URL, EDITOR_URL, GITHUB_URL, external } from "../config";

/* /contact — one inbox, sorted by what the message is about.
 *
 * The form has nothing to POST to: this site is static files with no server
 * behind them. So "Send" builds a mailto: to the same address the Privacy
 * Policy and the Terms already publish, with the topic in the subject line and
 * the fields in the body, and hands it to the reader's own mail app. Nothing is
 * stored here, and nothing pretends to have been sent when it has not — the
 * after-state says the mail app should have opened, and shows the address in
 * case it didn't.
 *
 * The design's screenshot upload is the one field a mailto: cannot carry, so
 * the Bug topic says to attach it in the mail app instead.
 */

const EMAIL = "chrislanejones@gmail.com";

type TopicLink = { label: string; href: string };

interface Topic {
  key: string;
  label: string;
  count: string;
  title: string;
  blurb: string;
  messageLabel: string;
  placeholder: string;
  cta: string;
  note: string;
  askBrowser?: boolean;
  attach?: boolean;
  links: TopicLink[];
}

const TOPICS: Topic[] = [
  {
    key: "question",
    label: "Question",
    count: "or feedback",
    title: "Ask anything, or tell me what you think.",
    blurb: "Questions, feedback, a tool you wish it had. Short is fine.",
    messageLabel: "Your message",
    placeholder: "What's on your mind?",
    cta: "Send",
    note: "Replies come from the one person who wrote the code, usually within a few days.",
    links: [],
  },
  {
    key: "bug",
    label: "Bug",
    count: "something broke",
    title: "Something broke.",
    blurb:
      "A screenshot and the name of your browser make a bug much quicker to find. If you'd rather it be public, open an issue instead — but leave out anything private.",
    messageLabel: "What happened, and what you expected",
    placeholder: "I clicked … and then …",
    cta: "Report it",
    askBrowser: true,
    attach: true,
    note: "Issues on GitHub and Codeberg are public. This form is not.",
    links: [
      { label: "Open an issue on GitHub", href: `${GITHUB_URL}/issues` },
      { label: "…or on Codeberg", href: `${CODEBERG_URL}/issues` },
    ],
  },
  {
    key: "feature",
    label: "Feature",
    count: "a tool you wish it had",
    title: "A tool you wish it had.",
    blurb:
      "Say what you were trying to do, not just the button you wanted. The Coming Soon page shows what's already decided.",
    messageLabel: "What were you trying to do?",
    placeholder: "I had forty photos and needed to …",
    cta: "Suggest it",
    note: "Ideas that fit the no-upload principle get the most attention.",
    links: [{ label: "See what's already coming", href: "/coming-soon" }],
  },
  {
    key: "security",
    label: "Security",
    count: "private report",
    title: "You found a way in.",
    blurb:
      "If you can reach something you shouldn't be able to, send it here rather than opening an issue, so it can be fixed before it is public.",
    messageLabel: "What you found, and how to reproduce it",
    placeholder: "Steps, URLs, and what you saw",
    cta: "Report privately",
    askBrowser: true,
    note: "Private by default. You'll hear back, and be credited if you want to be.",
    links: [],
  },
  {
    key: "account",
    label: "Account",
    count: "your data",
    title: "Your account and your data.",
    blurb:
      "Without an account, your photos and edits live in your browser and never reach me. If you made one, write from the address you signed in with to have it — and everything stored with it — deleted.",
    messageLabel: "What would you like done?",
    placeholder: "Please delete my account and everything with it",
    cta: "Send request",
    note: "The Privacy Policy lists exactly what is stored with an account.",
    links: [{ label: "Privacy Policy", href: "/privacy-policy" }],
  },
];

function mailtoFor(topic: Topic, fields: Record<string, string>) {
  const lines = [fields.message ?? "", "", "—"];
  if (fields.name) lines.push(`Name: ${fields.name}`);
  if (fields.email) lines.push(`Reply to: ${fields.email}`);
  if (topic.askBrowser && fields.browser) lines.push(`Browser and device: ${fields.browser}`);
  const subject = `Image Horse — ${topic.label}`;
  return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function TopicLinkPill({ link }: { link: TopicLink }) {
  return link.href.startsWith("/") ? (
    <Link className="contact-pill" to={link.href}>
      {link.label}
    </Link>
  ) : (
    <a className="contact-pill" href={link.href} {...external}>
      {link.label}
    </a>
  );
}

export default function Contact() {
  const [key, setKey] = useState("question");
  const [sent, setSent] = useState(false);
  const topic = TOPICS.find((t) => t.key === key) ?? TOPICS[0];

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    window.location.href = mailtoFor(topic, data);
    setSent(true);
  };

  return (
    <>
      <main id="main">
        <header className="contact-head">
          <div className="contact-head__lead">
            <p className="contact-head__eyebrow">Contact · one inbox</p>
            <h1 className="contact-head__title">It reaches the person who wrote the code.</h1>
          </div>
          <p className="contact-head__deck">
            Image Horse is one person&rsquo;s project. Questions, feedback, a tool you wish it had
            &mdash; pick what it&rsquo;s about and it lands in the right place.
          </p>
        </header>

        <section className="contact-topics" aria-label="What is this about">
          <div role="group" className="contact-topics__grid">
            {TOPICS.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={t.key === key}
                className={`contact-tile${t.key === key ? " is-on" : ""}`}
                onClick={() => {
                  setKey(t.key);
                  setSent(false);
                }}
              >
                <span className="contact-tile__label">{t.label}</span>
                <span className="contact-tile__count">{t.count}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="contact-board" aria-label="Message">
          <div className="contact-board__about">
            <h2 className="contact-board__title">{topic.title}</h2>
            <p className="contact-board__blurb">{topic.blurb}</p>
            {topic.links.length > 0 && (
              <div className="contact-board__links">
                {topic.links.map((l) => (
                  <TopicLinkPill key={l.href} link={l} />
                ))}
              </div>
            )}
            <p className="contact-board__note">{topic.note}</p>
          </div>

          {!sent ? (
            <form className="contact-form" onSubmit={submit} key={topic.key}>
              <label className="contact-field">
                Your name
                <input type="text" name="name" autoComplete="name" placeholder="Optional, but nicer" />
              </label>
              <label className="contact-field">
                Email to reply to
                <input type="email" name="email" autoComplete="email" placeholder="you@example.com" />
              </label>
              {topic.askBrowser && (
                <label className="contact-field">
                  Browser and device
                  <input type="text" name="browser" placeholder="e.g. Chrome 130 on a MacBook" />
                </label>
              )}
              <label className="contact-field">
                {topic.messageLabel}
                <textarea name="message" required rows={6} placeholder={topic.placeholder} />
              </label>
              {topic.attach && (
                <p className="contact-form__attach">
                  Got a screenshot? Attach it in your mail app when it opens &mdash; this form
                  can&rsquo;t carry files.
                </p>
              )}
              <div className="contact-form__foot">
                <p className="contact-form__fine">
                  Opens your mail app, addressed to one inbox. Nothing is stored on this site.
                </p>
                <button type="submit" className="contact-form__send">
                  {topic.cta}
                </button>
              </div>
            </form>
          ) : (
            <div className="contact-sent" role="status">
              <p className="contact-sent__kicker">Ready to send</p>
              <p className="contact-sent__title">Your mail app should have opened.</p>
              <p className="contact-sent__body">
                Send it from there. If nothing opened, write to{" "}
                <a href={`mailto:${EMAIL}`}>{EMAIL}</a> &mdash; replies come from the same person
                who wrote the code, usually within a few days.
              </p>
              <button type="button" className="contact-sent__again" onClick={() => setSent(false)}>
                Start over
              </button>
            </div>
          )}
        </section>

        <section className="contact-coda">
          <div className="contact-coda__text">
            <p className="contact-coda__line">Or skip the message and try it.</p>
            <p className="contact-coda__sub">No account, no upload, nothing to sign.</p>
          </div>
          <a className="contact-coda__cta" href={EDITOR_URL} {...external}>
            Open the editor
          </a>
        </section>
      </main>

      <Footer line="One inbox, and the same person who wrote the code." />
    </>
  );
}
