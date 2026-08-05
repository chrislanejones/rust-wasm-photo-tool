// Content keys that are referenced from somewhere the gallery cannot see.
//
// THE PROBLEM THIS SOLVES
//
// `referencedOriginalKeys` derives the reachable set from the gallery: every
// photo's `originalKey` and `uploadKey`. That is the complete root set for
// anything persisted — but not for everything ALIVE.
//
// `BatchSettings` keeps a per-photo "pre-logo" and "pre-text" baseline in React
// refs (`logoBaselineRef` / `textBaselineRef`) so re-applying a logo replaces
// it instead of stacking. Those keys appear in NO manifest, NO PhotoEntry, and
// are invisible to `contentAudit` as well — the audit counts them as orphans
// today. Collect one and re-apply silently stacks instead of replacing.
//
// The repoint call sites live INSIDE BatchSettings, so they just pass the refs
// straight to `deleteReplacedOriginal`. The DELETE path does not: it lives in
// `app/session/useImageSession.ts`, several modules away, and cannot reach a
// child component's refs. Hence a registry.
//
// WHY A PROVIDER REGISTRY RATHER THAN MOVING THE REFS TO A STORE
//
// Moving the two Maps into module scope or a Zustand store would also make them
// readable, and would change their LIFETIME: refs die when BatchSettings
// unmounts, module state does not. That is a behaviour change disguised as a
// refactor — today, leaving the Batch tool and returning loses the baselines,
// so a re-applied logo stacks. Maybe that should be fixed; it is not this
// change, and doing it silently while fixing a delete bug is how one bug turns
// into two.
//
// A provider keeps the existing lifetime exactly: unmounted BatchSettings
// deregisters, contributes no roots — and it also holds no live baselines, so
// there is nothing left to protect. The two facts stay in sync because they are
// the same fact.
//
// Bias, as everywhere in this area: when in doubt, KEEP. A provider that throws
// is swallowed and contributes nothing rather than aborting the collection —
// but note that direction is toward DELETING more, so providers must be simple
// enough not to throw. Reading `.values()` off a Map qualifies.

type RootProvider = () => Iterable<string | undefined>;

const providers = new Set<RootProvider>();

/**
 * Declare a source of content keys the gallery cannot see. Returns the
 * deregister function, so a React caller can `useEffect(() => register(...), [])`
 * and have unmount handled for free.
 */
export function registerExtraRootProvider(provider: RootProvider): () => void {
  providers.add(provider);
  return () => {
    providers.delete(provider);
  };
}

/** Every extra root currently declared. Order is not meaningful. */
export function collectExtraRoots(): string[] {
  const out: string[] = [];
  for (const provider of providers) {
    try {
      for (const key of provider()) if (key) out.push(key);
    } catch {
      // A broken provider must not abort a delete. It does mean its keys go
      // unprotected, which is why providers stay trivial.
    }
  }
  return out;
}

/** Test seam — drop every provider. */
export function __resetExtraRootProviders(): void {
  providers.clear();
}
