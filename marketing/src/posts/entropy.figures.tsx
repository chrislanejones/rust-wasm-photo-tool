/* The figures of "We spent a month taking the file apart".
 *
 *   <Scene kind="giants" />           FIG 1 — the five pinned files against 900
 *   <Scene kind="drift" controls />   FIG 2 — one primitive, nine renderings
 *   <Scene kind="ratchet" controls /> FIG 3 — the ratchet, and where it stopped
 *   <Scene kind="giants" backdrop />  the header banner behind the headline
 *
 * The blog's shared frame (scene/figure.tsx), bound to this post's builders.
 * Everything else — the box, the fallback, the transport, three.js loading and
 * the stylesheet — comes with it.
 */

import { sceneFigure } from "./scene/figure";

export const Scene = sceneFigure(() => import("./entropy.scenes"));
