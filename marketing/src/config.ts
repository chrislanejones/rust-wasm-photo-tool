import { APP_URL, ROUTES } from "./seo";

/** The editor. Its own hostname on the same registrable domain, so a share link
 *  and a sign-in cookie both read as Image Horse rather than as some build host. */
export const EDITOR_URL = APP_URL;

/** Web3Forms access key for the contact form. PUBLIC by design — it only lets
 *  a form deliver to the inbox it was created for, and it ships in the page
 *  either way. Empty means the form falls back to opening the reader's mail app
 *  (the pre-Web3Forms behavior). Set it on the Vercel marketing project as
 *  VITE_WEB3FORMS_KEY; it is read at build time. */
export const WEB3FORMS_KEY: string = import.meta.env.VITE_WEB3FORMS_KEY ?? "";

export const GITHUB_URL = "https://github.com/chrislanejones/rust-wasm-photo-tool";
export const CODEBERG_URL = "https://codeberg.org/chrislanejones/rust-wasm-photo-tool";

/** Every page, in nav order. The nav, the mobile sheet, the footer and the ⌘K
 *  palette all read this — and it is now a projection of `ROUTES` in seo.ts, so
 *  the sitemap and the prerender read the same list too. A page that is in the
 *  nav is in the sitemap, always; there is no longer a second place to forget.
 *
 *  `footerOnly` routes are filtered out here rather than being kept out of
 *  ROUTES: the legal pages still need a sitemap entry and a prerendered head,
 *  they just do not belong in a nav of places to go. `toolPage` routes are
 *  filtered out for the mirror-image reason — there are ten of them and they
 *  have their own column in the footer and their own panel in the nav, so
 *  letting them into this list would bury the seven actual places on the
 *  site. */
export const PAGES = ROUTES.filter((r) => !r.footerOnly && !r.toolPage).map(({ to, label }) => ({
  to,
  label,
}));

/** The tool landing pages, for the footer's own column. Same projection again:
 *  a route with `toolPage: true` lands here and nowhere else. */
export const TOOL_NAV_PAGES = ROUTES.filter((r) => r.toolPage).map(({ to, label }) => ({
  to,
  label,
}));

/** The legal documents, for the footer's second row. Same projection, opposite
 *  filter, so a new `footerOnly: true` route lands here and nowhere else. */
export const LEGAL_PAGES = ROUTES.filter((r) => r.footerOnly).map(({ to, label }) => ({
  to,
  label,
}));

/** A file in the repository, on GitHub's default branch.
 *
 *  Posts cite the decision records and findings they are drawn from, and a
 *  hand-written absolute URL per citation is how those rot silently after a
 *  rename. Built from GITHUB_URL so the org and repo are written once.
 *
 *  `blob/master` and not a tag: the point of the link is to show the reader what
 *  the document says now, including the corrections it picked up afterwards —
 *  several of which the posts are about. */
export const repoFile = (path: string) => `${GITHUB_URL}/blob/master/${path}`;

/** Props for an off-site link. `noopener` is not optional — without it the
 *  opened page gets a handle on ours through window.opener. */
export const external = { target: "_blank", rel: "noopener noreferrer" } as const;
