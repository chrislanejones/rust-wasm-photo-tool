/* The colour the mask brush ring wears.
 *
 * This lives in its own module for one reason: the canvas and the test that
 * guards it must read the SAME rule. The first draft of the test carried its
 * own copy of `v >= 128 ? white : black`, which made it green no matter what
 * the canvas did — a check that cannot fail, which is the exact family of bug
 * this repo keeps writing down. Importing both from here means changing the
 * threshold changes a test.
 *
 * `maskPaintValue` is the 0–255 value the stroke writes into the mask plane:
 * 0 is black and hides, 255 is white and reveals.
 */

/** Mid-grey and up paints white. Not exported: both readers are in this file,
 *  and the dead-exports ratchet in guardrails.sh counts an export nobody
 *  imports as a violation. */
const MASK_WHITE_AT = 128;

/** The ring itself — the value the next stroke will paint. */
export const maskCursorInk = (paintValue: number): string =>
  paintValue >= MASK_WHITE_AT ? "#fff" : "#000";

/** The outline around it, always the opposite, so a black ring does not
 *  disappear into a dark photo and a white one does not vanish into a bright
 *  sky. The paired light/dark stroke is the same trick the selection cursors
 *  use over arbitrary pixels. */
export const maskCursorHalo = (paintValue: number): string =>
  paintValue >= MASK_WHITE_AT ? "#000" : "#fff";
