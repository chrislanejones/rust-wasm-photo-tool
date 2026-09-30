/* The figures of "The hotel Wi-Fi died. The editor kept running.".
 *
 *   <Scene kind="cut" />             FIG 1 — the cable is cut mid-edit
 *   <Scene kind="idb" controls />    FIG 2 — the IndexedDB round trip
 *   <Scene kind="cache" controls />  FIG 3 — shell and engine from Cache Storage
 *   <Scene kind="cut" backdrop />    the header banner behind the headline
 *
 * The blog's shared frame (scene/figure.tsx), bound to this post's builders.
 * Everything else — the box, the fallback, the transport, three.js loading and
 * the stylesheet — comes with it.
 */

import { sceneFigure } from "./scene/figure";

export const Scene = sceneFigure(() => import("./offline-by-construction.scenes"));
