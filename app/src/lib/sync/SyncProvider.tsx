// Mounts the sync layer. Renders nothing, like RouteSync next to it.
//
// Mounted at the composition root rather than inside AppShell, for the reason
// App.tsx already states about the other global chrome: AppShell must gain
// nothing new. It also has to outlive every screen — the sync layer keeps
// working while the user sits behind IdleScreen or MultiTabScreen, and a
// parked tab that comes back with "Use here" should already be current rather
// than start catching up.
import { useCloudSync } from "./useCloudSync";
import { SyncErrorBoundary } from "./SyncErrorBoundary";
import { SyncErrorToast } from "./SyncErrorToast";
import { setCurrentAccount } from "./ledger";

// Importing the registry is what CREATES the three documents and subscribes
// them to the cross-tab channel. Side-effecting on purpose: cross-tab sync
// must not depend on a component being mounted, because the logged-out path
// has no cloud half at all and the channel is the only sync it gets.
import "./docs";

/** True when this build has a Convex deployment to talk to. */
const CLOUD_CONFIGURED = Boolean(import.meta.env.VITE_CONVEX_URL);

// A build with no cloud half is signed out by definition. An account recorded
// by a keyed build on the same origin (a developer switching env files) would
// otherwise have every edit made here filed as owed to it, and sent the next
// time that build ran.
if (!CLOUD_CONFIGURED) setCurrentAccount(null);

function CloudSync() {
  useCloudSync();
  return null;
}

export function SyncProvider() {
  // A COMPONENT boundary, not a conditional hook: with no Convex URL there is
  // no ConvexProvider in the tree, and convex/react's hooks throw rather than
  // degrade. Keeping the hooks inside a child that is not rendered is what
  // makes the keyless build — a supported path, see the README — still get
  // cross-tab sync instead of a blank screen.
  // Nothing to set here: "disabled" is the status store's INITIAL value, and
  // `useCloudSync` — the only thing that writes it — is exactly what does not
  // mount on this branch. Writing it from a render body would be a side effect
  // during render, which wakes every subscriber mid-render (ADR-020).
  if (!CLOUD_CONFIGURED) return null;
  // The toast sits OUTSIDE the boundary on purpose: when `CloudSync` throws,
  // everything inside the boundary unmounts, and the thing that reports the
  // failure must not be one of the things that just went away.
  return (
    <>
      <SyncErrorToast />
      <SyncErrorBoundary>
        <CloudSync />
      </SyncErrorBoundary>
    </>
  );
}
