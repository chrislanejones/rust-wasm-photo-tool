// ===== FILE: app/src/features/routing/RouteSync.tsx =====
// Mounts the URL <-> state mirror. Renders nothing.
//
// It lives at the composition root (App.tsx), next to <CommandPalette/>, and
// deliberately NOT inside AppShell — AppShell is being dismantled and gains
// nothing new (CLAUDE.md). Being a component rather than a hook call in App()
// also means it simply isn't mounted on the `?v=` share-viewer branch, so a
// read-only shared image never gets an editor route written into its URL.
import { useHashRoute } from "./useHashRoute";

export function RouteSync(): null {
  useHashRoute();
  return null;
}
