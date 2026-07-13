// ===== FILE: app/src/features/routing/index.ts =====
// Public surface of the routing feature. Other features import from HERE, not
// from the internals (repo-boundaries). Kept to what callers actually use:
//
//   App.tsx              RouteSync, SHARE_PARAM
//   useKeyboardShortcuts navigateTo            (Alt+S -> #/settings/…)
//   commandPalette       navigateTo, currentRouteUrl, currentRouteLabel,
//                        parseHash, describeRoute, formatRoute
//   SubscriptionButton   SETTINGS_TAB_LABELS   (one naming for each pane)
// <RouteSync/> is the mount — the hook behind it stays internal, so there's one
// documented way to turn routing on.
export { RouteSync } from "./RouteSync";
export { navigateTo, currentRouteUrl, currentRouteLabel } from "./navigate";
export { parseHash, describeRoute, currentHash } from "./routeState";
export { formatRoute, SETTINGS_TAB_LABELS, SHARE_PARAM } from "./routes";
export type { Route } from "./routes";
