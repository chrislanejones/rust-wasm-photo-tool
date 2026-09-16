import { useCallback, useSyncExternalStore } from "react";

/* A media query React can read during a server render.
 *
 * The obvious version — `useState(() => matchMedia(q).matches)` plus an effect
 * — cannot survive prerendering twice over. Under Node there is no
 * `matchMedia` at all, so the initialiser throws; and even stubbed, the server
 * would commit to one answer while the browser hydrates with the real one, and
 * React would find a tree that doesn't match the HTML it was given. React's
 * recovery for that is to throw the prerendered markup away and re-render the
 * whole route on the client — which is precisely the empty-page-for-crawlers
 * problem the prerender exists to fix, reintroduced through the back door.
 *
 * `useSyncExternalStore` has the escape hatch built in: `getServerSnapshot` is
 * used for the server render AND for the first client render, so the two agree
 * by construction. React then subscribes and picks up the real value, in an
 * effect, where a layout change is allowed to happen.
 *
 * @param serverValue what to assume while prerendering and during hydration.
 *   Pick the value that degrades best if it turns out wrong — a mobile-first
 *   default, usually, since that is also what a crawler on a phone user-agent
 *   should see.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => serverValue,
  );
}
