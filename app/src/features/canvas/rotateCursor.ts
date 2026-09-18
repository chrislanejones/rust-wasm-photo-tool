// Shared by the two rotate hooks — the text box's (CanvasArea) and the
// shapes' (ShapeEditOverlay) — so the glyph cannot drift between them.
// Data-URI SVG cursor for the rotate handle — there's no standard CSS
// rotation cursor, so we draw a small curved-arrow glyph. Falls back to
// `grab` if the browser can't decode the data-URI. Two stacked strokes
// (black outer 3.5, white inner 2.5) keep it visible against any background.
export const ROTATE_CURSOR =
  "url(\"data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M21 12a9 9 0 1 1-3-6.7' stroke='black' stroke-width='3.5'/>
      <polyline points='21 4 21 12 13 12' stroke='black' stroke-width='3.5'/>
      <path d='M21 12a9 9 0 1 1-3-6.7' stroke='white' stroke-width='2.5'/>
      <polyline points='21 4 21 12 13 12' stroke='white' stroke-width='2.5'/>
    </svg>`,
  ) +
  "\") 12 12, grab";
