export const EDITOR_URL = "https://rust-wasm-photo-tool.netlify.app";
export const GITHUB_URL = "https://github.com/chrislanejones/rust-wasm-photo-tool";
export const CODEBERG_URL = "https://codeberg.org/chrislanejones/rust-wasm-photo-tool";

/** Every page, in nav order. The nav, the mobile sheet, the footer and the ⌘K
 *  palette all read this, so a new page appears in all four or in none. */
export const PAGES = [
  { to: "/", label: "Home" },
  { to: "/architecture", label: "Architecture" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/trail-log", label: "Trail Log" },
] as const;

/** Props for an off-site link. `noopener` is not optional — without it the
 *  opened page gets a handle on ours through window.opener. */
export const external = { target: "_blank", rel: "noopener noreferrer" } as const;
