import { APP_URL, ROUTES } from "./seo";

/** The editor. Its own hostname on the same registrable domain, so a share link
 *  and a sign-in cookie both read as Image Horse rather than as some build host. */
export const EDITOR_URL = APP_URL;

export const GITHUB_URL = "https://github.com/chrislanejones/rust-wasm-photo-tool";
export const CODEBERG_URL = "https://codeberg.org/chrislanejones/rust-wasm-photo-tool";

/** Every page, in nav order. The nav, the mobile sheet, the footer and the ⌘K
 *  palette all read this — and it is now a projection of `ROUTES` in seo.ts, so
 *  the sitemap and the prerender read the same list too. A page that is in the
 *  nav is in the sitemap, always; there is no longer a second place to forget. */
export const PAGES = ROUTES.map(({ to, label }) => ({ to, label }));

/** Props for an off-site link. `noopener` is not optional — without it the
 *  opened page gets a handle on ours through window.opener. */
export const external = { target: "_blank", rel: "noopener noreferrer" } as const;
