// The one live pairing attempt for this tab (ADR-105). Module state rather
// than a component's, so closing the dialog or the gallery does not drop a
// connection the next PR sends photos over.
import { isNetworkPathAllowed } from "@/lib/networkPaths";
import { useUIStore } from "@/stores/useUIStore";
import { hostPairing, joinPairing, type PairDeps, type PairHandle } from "./connection";
import { usePairStore, type PairRole } from "./pairStore";
import { newClientToken } from "./protocol";
import type { PairSignaling } from "./signaling";

let active: PairHandle | null = null;
let generation = 0;
let clientToken: string | null = null;

function deps(signaling: PairSignaling): PairDeps {
  clientToken ??= newClientToken();
  return {
    signaling,
    createPeer: (config) => new RTCPeerConnection(config),
    clientToken,
    now: () => Date.now(),
  };
}

/** May this device reach the signaling server right now? Read at call time,
 *  like useShare: the switch may have moved since the last render. */
function pairAllowedNow(): boolean {
  return isNetworkPathAllowed("pair", useUIStore.getState().onlineFeaturesEnabled);
}

function start(role: PairRole, run: (emit: Parameters<typeof hostPairing>[1]) => PairHandle): void {
  stopPairing();
  const mine = ++generation;
  const store = usePairStore.getState();
  store.begin(role);
  if (typeof RTCPeerConnection === "undefined") {
    store.apply({ status: "error" });
    return;
  }
  active = run((u) => {
    // An attempt that was replaced may still be finishing an await.
    if (mine === generation) usePairStore.getState().apply(u);
  });
}

/** The computer: a fresh QR code. Refused while the switch is off. */
export function startHosting(signaling: PairSignaling): void {
  if (!pairAllowedNow()) return;
  const { origin, pathname } = window.location;
  start("computer", (emit) => hostPairing(deps(signaling), emit, { origin, pathname }));
}

/** The phone: join with the secret from the link. Refused while the switch is off. */
export function startJoining(signaling: PairSignaling, secret: string): void {
  if (!pairAllowedNow()) return;
  start("phone", (emit) => joinPairing(deps(signaling), emit, secret));
}

/** End the attempt, whatever state it is in, and go back to idle. */
export function stopPairing(): void {
  if (active) {
    // Bumped first, so the attempt's own "stopped" does not land after reset.
    generation++;
    active.stop();
    active = null;
  }
  usePairStore.getState().reset();
}

export function isPairingActive(): boolean {
  return active !== null;
}
