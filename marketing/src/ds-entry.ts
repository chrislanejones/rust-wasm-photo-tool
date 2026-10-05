// The design-system surface of the marketing site.
//
// This file exists ONLY for /design-sync. The marketing site is a Vite app,
// not a published package: there is no `main`/`module`/`exports` and no
// `dist/` of components, so the converter has no entry to read. This is that
// entry, written by hand so the scope is explicit rather than whatever a
// synth-from-src heuristic happens to pick up.
//
// SCOPE — Chris, 09-24-2026: the marketing vocabulary, not the editor's
// primitives. And within marketing, the point of the sync is that a Claude
// Design mockup comes out already written in our tokens and class names, so
// what earns a place here is what a mockup would actually COMPOSE:
//
//   ButtonSet   the .cta family — the site's only real button vocabulary
//   Slider      the one form control
//   Pager       page-at-a-time navigation (Trail Log; reusable by design)
//   NextCards   the four-card grid that closes every page
//   Footer      the site footer, including the horse variant
//   Nav         the floating pill nav + mega menu
//
// Deliberately NOT here, with reasons:
//   CubeLetters / HorseTrot  three/webgpu behind a lazy chunk boundary; they
//                            need a GPU adapter the design runtime may not
//                            have, and a card that renders a blank canvas is
//                            worse than no card.
//   OraViewer                an interactive file-drop surface; there is
//                            nothing to see without a .ora in hand.
//   CommandPalette           opens on a keystroke over the whole page.
//   OraFaq / OraSubPage      page scaffolding for four specific pages.
//   NajiBanner               a single fixed site-wide bar, not a part.
//   Icons / NajiArabic       an icon map and one glyph.
//
// Nav, Footer, NextCards and Pager reach for react-router, so previews wrap
// in a MemoryRouter — see `provider` in .design-sync/config.json.
// Must be first — see the file for why.
import "./ds-shim";

export { default as ButtonSet } from "./components/ButtonSet";
export { default as Slider } from "./components/Slider";
export { default as Pager } from "./components/Pager";
export { default as NextCards } from "./components/NextCards";
export { default as Footer } from "./components/Footer";
export { default as Nav } from "./components/Nav";

// Re-exported so `cfg.provider.component` can resolve it: the provider has to
// be an export of THIS bundle (window.ImageHorseMarketing.*), not a bare npm
// import the preview runtime has no way to reach.
export { MemoryRouter } from "react-router";
