// The phone's side of the QR code: `#/pair/<secret>` (ADR-105).
//
// Called ONCE in main.tsx, before the router, the analytics and React. It
// takes the fragment out of the address bar with `replaceState` (no history
// entry, no hashchange) and keeps the secret in memory only. So:
//   - the router never sees it, and never writes it back;
//   - GA4's page_view, which reads `document.location` when gtag.js loads,
//     and Vercel Analytics, which reads it on mount, both see a bare URL;
//   - Back, a bookmark, or a shared screenshot of the address bar hold none.
// A browser never sends a fragment in a request, so no server saw it either.
import { usePairStore } from "./pairStore";
import { secretFromHash } from "./protocol";

const PREFIX = "#/pair/";

/** Take a pairing secret out of the URL. Returns it ("" for a mangled one),
 *  or null when this is not a pairing link. */
export function captureInviteFromUrl(
  loc: Pick<Location, "hash" | "pathname" | "search"> = window.location,
  hist: Pick<History, "replaceState" | "state"> = window.history,
): string | null {
  if (!loc.hash.startsWith(PREFIX)) return null;
  const secret = secretFromHash(loc.hash) ?? "";
  try {
    hist.replaceState(hist.state, "", `${loc.pathname}${loc.search}`);
  } catch {
    // A sandboxed document: the fragment stays, which the router then heals.
  }
  usePairStore.getState().setInvite(secret);
  return secret;
}
