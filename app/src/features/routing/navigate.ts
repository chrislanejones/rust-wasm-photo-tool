// ===== FILE: app/src/features/routing/navigate.ts =====
// The location layer — the ONLY place in the app that writes `window.location`
// for navigation. Everything that wants to move the user (the palette, a
// deep link, back/forward) goes through `navigateTo`.
import { buildRouteUrl, formatRoute, stripRoutingParams, type Route } from "./routes";
import { applyRoute, describeRoute, readRoute } from "./routeState";

/**
 * Write a fragment, if it isn't already there.
 *
 * The compare-before-write is half the loop guard (the other half is
 * `applyRoute`'s compare-before-set): an identical hash is never re-assigned,
 * so no `hashchange` fires, so nothing re-applies, so the mirror can't
 * oscillate.
 *
 * `replace` swaps the current history entry instead of pushing one — used for
 * canonicalisation (adopting `?tool=…`, healing a garbage hash, the first
 * write on load), which should not cost the user a Back press. NB
 * `replaceState` deliberately does NOT fire `hashchange`; we already have the
 * state it describes.
 */
export function writeHash(hash: string, opts: { replace?: boolean } = {}): void {
  // Routing writes a URL only where there is one. Guards the one path the
  // palette's own tests exercise under vitest's node environment (a nav command
  // -> navigateTo -> writeHash), where `window` doesn't exist; applyRoute still
  // runs, so the assertion under test is unaffected.
  if (typeof window === "undefined") return;
  if (window.location.hash === hash) return;
  if (opts.replace) {
    const { origin, pathname, search } = window.location;
    window.history.replaceState(null, "", `${origin}${pathname}${search}${hash}`);
    return;
  }
  window.location.hash = hash;
}

/**
 * Go to a route: apply it to the stores AND record it in the URL.
 *
 * Applying directly (rather than only writing the hash and waiting for
 * `hashchange` to bounce back) keeps navigation synchronous and independent of
 * event timing. It is safe precisely because `applyRoute` is idempotent — when
 * the bounce does arrive it finds every value already correct and does
 * nothing.
 */
export function navigateTo(route: Route): void {
  applyRoute(route);
  writeHash(formatRoute(route));
}

/** The shareable link to the current view. Routing params are stripped (the
 *  hash is canonical); `?v=` and utm_* survive. */
export function currentRouteUrl(): string {
  const { origin, pathname, search } = window.location;
  return buildRouteUrl(origin, pathname, search, readRoute());
}

/** Human name for the current view — the copy-link toast says where the link
 *  points, so you can tell at a glance that you copied the right one. */
export const currentRouteLabel = (): string => describeRoute(readRoute());

/** Remove routing params from the address bar once they've been adopted into
 *  the fragment, so a stale `?tool=…` can't fight the hash later. */
export function dropRoutingParams(): void {
  const { origin, pathname, search, hash } = window.location;
  const cleaned = stripRoutingParams(search);
  if (cleaned === search) return;
  window.history.replaceState(null, "", `${origin}${pathname}${cleaned}${hash}`);
}
