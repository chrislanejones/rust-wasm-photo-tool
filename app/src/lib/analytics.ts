// Google Analytics 4 for the EDITOR (edit.imagehorse.app). Its own property —
// G-NVVF53KKNK — separate from the marketing site's G-8RYJ8KWYRW.
//
// ⚠️ NOT THE SNIPPET GOOGLE HANDS YOU. That snippet is a loader plus an INLINE
// bootstrap, and this app's CSP is `script-src 'self' 'wasm-unsafe-eval'
// '<sha256>' https://*.clerk.accounts.dev` — no 'unsafe-inline'. The one inline
// script that IS allowed is allowed by a hand-maintained hash, and adding a
// second means a second hash to recompute by hand whenever the snippet's
// whitespace moves. So the loader is injected from here and there is no inline
// script; `script-src` only has to name googletagmanager, and `connect-src`
// google-analytics (both in the root vercel.json beside this).
//
// ⚠️ THIS IS THE SECOND ANALYTICS SYSTEM IN THIS APP. `@vercel/analytics`
// already counts pageviews, cookielessly, from `main.tsx`. GA4 sets cookies and
// contacts Google on every load — a different bargain entirely, and one that is
// in tension with what the marketing site promises about this surface
// ("Nothing leaves your tab by accident") and with the `onlineFeaturesEnabled`
// switch in the New dialog, which exists to make exactly that kind of send a
// choice. Added at Chris's explicit request, 2026-09-16, and left UNGATED so it
// measures everyone; if that tension is ever resolved in favour of the promise,
// the switch is the hook to hang it on.

const GA_ID = "G-NVVF53KKNK";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let started = false;

/** Injects gtag once. No-op in dev, so a developer's reloads never land in the
 *  real property — GA cannot tell them from a visitor's, and the contamination
 *  is permanent. */
export function initAnalytics(): void {
  if (started || typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;
  started = true;

  window.dataLayer = window.dataLayer || [];
  // A real `function` pushing `arguments`, not an arrow pushing a rest array:
  // the one part of Google's snippet worth copying verbatim.
  function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  // The editor is ONE page — its routes are hash fragments (#/enhance/levels)
  // that swap a tool panel, not documents. gtag's default single page_view at
  // load is therefore the honest count here, unlike the marketing site where
  // every route is a separate document and the default would miss all but the
  // first. Left ON deliberately; do not copy `send_page_view: false` across.
  gtag("config", GA_ID);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}
