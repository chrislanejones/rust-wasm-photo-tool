// Google Analytics 4 for the marketing site.
//
// ⚠️ NOT THE SNIPPET GOOGLE HANDS YOU, and the difference is not stylistic.
// That snippet is two <script> tags in index.html: a loader and an INLINE
// bootstrap. Both are refused by this site's CSP, which is `script-src 'self'`
// with no 'unsafe-inline' (see marketing/vercel.json). Pasting it would have
// worked in dev, reported violations in production while the policy is
// report-only, and gone silently dead the day it is enforced.
//
// So the loader is injected here instead and there is NO inline script at all.
// The alternative — keeping the inline block and adding its sha256 to the CSP —
// means a hash that has to be recomputed by hand every time the snippet's
// whitespace changes, and a wrong one fails closed. `script-src` still has to
// allow googletagmanager (a dynamically-created script is subject to it exactly
// like a parsed one) and `connect-src` has to allow google-analytics; both are
// in marketing/vercel.json beside this.
//
// `send_page_view: false` is deliberate. gtag's default fires ONE page_view at
// load, which on a client-routed SPA means every route after the first is
// invisible. The app sends its own from a `useLocation` effect instead —
// including the first — so navigations count and nothing double-counts.

const GA_ID = "G-8RYJ8KWYRW";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let started = false;

/** Injects gtag once. No-op in dev, so local navigation never lands in the
 *  real property's numbers — the failure there is silent and permanent, since
 *  GA has no way to tell a developer's reload from a visitor's. */
export function initAnalytics(): void {
  if (started || typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;
  started = true;

  window.dataLayer = window.dataLayer || [];
  // A real `function`, not an arrow, and pushing `arguments` rather than a rest
  // array: this is the shape gtag.js expects, and it is the one part of the
  // official snippet worth copying verbatim.
  function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GA_ID, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

/** One page_view per route. Safe before the loader has finished: gtag queues
 *  into dataLayer, and gtag.js drains it when it arrives. */
export function trackPageView(path: string): void {
  window.gtag?.("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
