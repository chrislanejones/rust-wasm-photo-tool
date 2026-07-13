// ===== FILE: app/src/features/routing/useHashRoute.ts =====
// The two-way mirror between the URL and the stores. Mounted once, at the
// composition root (App.tsx), via <RouteSync/>.
//
//   location -> state : `hashchange` (which is also what Back/Forward fire for
//                       fragment-only history entries)
//   state -> location : a zustand subscription on the tool + UI stores
//
// LOOP GUARD — no "isNavigating" boolean anywhere. Both directions are
// idempotent and compare before they write:
//   • applyRoute() only calls a setter when the value differs
//   • writeHash() only assigns location.hash when the fragment differs
// So hash -> state -> (recompute hash) -> identical -> stop. There is no
// second write to bounce off.
import { useEffect } from "react";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { applyRoute, currentHash, parseHash, parseSearch } from "./routeState";
import { dropRoutingParams, writeHash } from "./navigate";

export function useHashRoute(): void {
  useEffect(() => {
    // ── Boot ────────────────────────────────────────────────────────────────
    // Precedence: a parseable fragment wins. Query params (?tool=…&mode=…,
    // ?settings=…) are only an inbound alias for contexts that strip
    // fragments — adopt them, canonicalise into the hash, then drop them so
    // there is never a stale second source of truth in the address bar.
    // Anything else (garbage, empty) heals to the app's actual state.
    // Everything on boot is a REPLACE: arriving at a page shouldn't leave a
    // history entry you have to press Back through to leave the site.
    const fromHash = parseHash(window.location.hash);
    const fromSearch = fromHash ? null : parseSearch(window.location.search);
    const initial = fromHash ?? fromSearch;
    if (initial) applyRoute(initial);
    if (fromSearch) dropRoutingParams();
    writeHash(currentHash(), { replace: true });

    // ── location -> state ───────────────────────────────────────────────────
    const onHashChange = () => {
      const route = parseHash(window.location.hash);
      if (route) applyRoute(route);
      // Whether we honoured it or not, re-assert the canonical fragment: a
      // typo'd/garbage hash heals back to where the app actually is instead of
      // sitting in the address bar lying about the view.
      writeHash(currentHash(), { replace: true });
    };
    window.addEventListener("hashchange", onHashChange);

    // ── state -> location ───────────────────────────────────────────────────
    // Catches every navigation that DIDN'T come through navigateTo(): a tool
    // click in the sidebar, a digit-key shortcut, closing the Settings modal.
    // Those still push a history entry, so Back walks your tool history.
    const onStoreChange = () => writeHash(currentHash());
    const unsubTool = useToolStore.subscribe(onStoreChange);
    const unsubUI = useUIStore.subscribe(onStoreChange);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      unsubTool();
      unsubUI();
    };
  }, []);
}
