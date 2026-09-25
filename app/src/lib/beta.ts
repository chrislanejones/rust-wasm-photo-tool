// Beta features: the small ring of people who see a thing before everyone does.
//
// WHY THIS EXISTS. Shipping went straight from "on Chris's machine" to "on
// production for everyone", with nothing in between. The in-between already
// existed in pieces — `featureFlags.ts` has carried the opt-in experiments for
// releases — but the only way into one was typing its key into DevTools, so
// the ring was exactly one person wide: everyone who could opt in already knew
// the key names.
//
// THIS IS RING 2 (ADR-064). Ring 1 is Chris, through Super User and the `ih_*`
// switches. Ring 2 is a handful of invited people, opting in per device, from
// Settings. Ring 3 — a percentage of signed-in accounts, flipped from the
// server — is deliberately NOT here: it can turn a feature on for someone who
// never asked, which is a different promise and wants its own decision.
//
// ── THIS FILE NAMES NO KEYS ─────────────────────────────────────────────────
//
// The registry is `featureFlags.ts`, which already holds every `ih_*` key
// beside the module's OWN predicate, and whose header says plainly why a second
// copy of a key is the failure this repo keeps hitting. A flag joins the ring
// by growing a `beta` block there; this module filters for it, reads through
// `flag.isOn()` and writes through `setFlagOverride`. Nothing here can disagree
// with the behavior, and DevTools still works exactly as before.
//
// ── THE OTHER TWO RULES ─────────────────────────────────────────────────────
//
// NOTHING LEAVES THE DEVICE. A choice here is a localStorage key and no more:
// no account, no id, no request. `lib/sync/identity.ts` records why the old
// per-browser device id was deleted — it was uploaded for no feature — and the
// same standard binds this: a rollout that needs to tell devices apart is a
// privacy-policy decision first, and it is not this.
//
// OFF IS THE DEFAULT AND THE FALLBACK. An unknown id, blocked storage, a value
// that is not the flag's own "on" — all off. A beta feature that failed open
// would be a feature that shipped without being decided.
//
// ── THE INVITE LINK ─────────────────────────────────────────────────────────
// `?beta=smart-brush` turns that feature on for the device that opens it, then
// takes itself out of the URL so the link is not re-applied on every reload or
// carried into a bookmark. `?beta=none` clears every one of them, which is the
// way back for someone who cannot find the pane. Read ONCE at boot
// (`main.tsx`), never during a render.
import {
  FEATURE_FLAGS,
  setFlagOverride,
  type BetaListing,
  type FeatureFlag,
} from "@/lib/featureFlags";

/** A registry row that opted into the ring, flattened for the pane. The key is
 *  NOT copied out — `flag` carries it, and so does every read and write. */
export interface BetaFeature extends BetaListing {
  flag: FeatureFlag;
}

/** Every experiment a person outside this repo can be invited into: the
 *  `optin` rows of `FEATURE_FLAGS` that carry a `beta` block, in registry
 *  order. An entry is a PROMISE that the switch reaches real code — true by
 *  construction here, because the row that offers it is the row the feature's
 *  own module is read through. */
export const BETA_FEATURES: readonly BetaFeature[] = FEATURE_FLAGS.filter(
  (f): f is FeatureFlag & { beta: BetaListing } => f.kind === "optin" && !!f.beta,
).map((flag) => ({ ...flag.beta, flag }));

export function betaFeature(id: string): BetaFeature | undefined {
  return BETA_FEATURES.find((f) => f.id === id);
}

const listeners = new Set<() => void>();

/** Is this experiment on for this device? Asked of the feature's own
 *  predicate, never of storage. Unknown id ⇒ false. */
export function isBetaOn(id: string): boolean {
  const feature = betaFeature(id);
  if (!feature) return false;
  try {
    return feature.flag.isOn();
  } catch {
    return false;
  }
}

/** Turn one on or off for this device. A no-op for an id nobody registered. */
export function setBetaOn(id: string, on: boolean): void {
  const feature = betaFeature(id);
  if (!feature) return;
  // `setFlagOverride` knows what "on" means for each kind and CLEARS the key
  // for off rather than writing a second spelling of it.
  setFlagOverride(feature.flag, on);
  for (const listener of listeners) listener();
}

/** Subscribe to changes here and (via the `storage` event) in the other tabs. */
export function subscribeBeta(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || BETA_FEATURES.some((f) => f.flag.key === e.key)) listener();
  };
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener?.("storage", onStorage);
  };
}

/**
 * Apply `?beta=` from the address bar, then remove it from the URL.
 *
 * Call ONCE, before React renders (main.tsx). Returns the ids it turned on, for
 * the boot log — the person who opened the link is told by the pane, not by a
 * toast they did not ask for.
 *
 * `?beta=none` (or an empty value) clears every feature: the way out when
 * someone is stuck and cannot find Settings.
 */
export function applyBetaFromUrl(search = window.location.search): string[] {
  let value: string | null;
  try {
    value = new URLSearchParams(search).get("beta");
  } catch {
    return [];
  }
  if (value === null) return [];

  const turnedOn: string[] = [];
  const wanted = value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (wanted.length === 0 || wanted.includes("none")) {
    for (const f of BETA_FEATURES) setBetaOn(f.id, false);
  } else {
    for (const id of wanted) {
      if (!betaFeature(id)) continue; // a link for a feature this build lacks
      setBetaOn(id, true);
      turnedOn.push(id);
    }
  }

  stripBetaParam();
  return turnedOn;
}

/** Take `beta` out of the address bar without touching the rest of it — the
 *  hash route, and `?v=` on a share link, both have to survive. */
function stripBetaParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("beta")) return;
    url.searchParams.delete("beta");
    const query = url.searchParams.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${query ? `?${query}` : ""}${url.hash}`,
    );
  } catch {
    // No history API (or a sandboxed document): the param stays, which only
    // means the link re-applies a choice the person already made.
  }
}

/** The link that turns a feature on for whoever opens it. */
export function betaInviteUrl(id: string): string {
  return `${window.location.origin}${window.location.pathname}?beta=${id}`;
}
