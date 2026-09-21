// The cross-DEVICE half. One reactive Convex query carries every synced
// document for the signed-in user; one mutation sends this device's changes
// back. `reconcile` decides which of those happens, per document.
//
// There is exactly ONE place where a document is acted on — `runSync` below —
// and four things that call it: the query updating (another device wrote), a
// local change (this device wrote), auth flipping, and a retry timer. Keeping
// it to one function is deliberate: every sync bug this design can still have
// is a bug in the reconcile rule, which is pure and enumerated in
// reconcile.test.ts, rather than a race between two effects that each thought
// they owned the document.
import { useCallback, useEffect, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { logDiagnostic } from "@/lib/diagnosticsLog";
import { deviceId } from "./identity";
import { SYNCED_DOCS } from "./docs";
import { onLocalChange } from "./syncedDoc";
import { reconcile, type RemoteDocState } from "./reconcile";
import { setSyncStatus } from "./status";
import type { SyncKey } from "./keys";

/** How long to sit on a local change before pushing it. Long enough that
 *  dragging a slider is one write rather than forty; short enough that
 *  switching to the other device at a normal human pace finds it already
 *  there. The same debounce the settings blob used before this layer. */
const PUSH_DEBOUNCE_MS = 600;

/** Backoff after a failed push. The failure modes worth surviving are a
 *  dropped connection and a cold Convex deployment; both clear in seconds. A
 *  local change also retries immediately, so this only carries the case where
 *  the user has stopped touching anything. */
const RETRY_MS = 5_000;

/**
 * Drive the cloud half of the sync layer. Mount ONCE, at the composition root
 * (`SyncProvider`) — a second instance would double every push.
 */
export function useCloudSync(): void {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const remote = useQuery(api.sync.pull, isAuthenticated ? {} : "skip");
  const push = useMutation(api.sync.push);

  // The latest pull, read inside async work that may outlive the render it
  // started in. A stale closure here would reconcile against a snapshot of
  // the account from before the change that woke us up.
  //
  // Typed by INFERENCE from the query rather than by a hand-written shape:
  // `api.sync.pull`'s return type is generated from convex/sync.ts, so adding
  // or renaming a field there is a typecheck error here instead of a silently
  // wrong read at runtime.
  const remoteRef = useRef(remote);
  remoteRef.current = remote;

  const runningRef = useRef(false);
  const rerunRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authedRef = useRef(false);
  authedRef.current = isAuthenticated;

  const runSync = useCallback(async () => {
    if (!authedRef.current) return;
    const pull = remoteRef.current;
    if (pull === undefined) return; // still loading — never push into the dark
    if (pull === null) return; // signed out, or the users row is not created yet

    // Serialize passes. Each pass awaits store hydration and a network
    // round-trip; two overlapping passes would both read the same dirty
    // document and push it twice.
    if (runningRef.current) {
      rerunRef.current = true;
      return;
    }
    runningRef.current = true;

    try {
      const byKey = new Map<string, RemoteDocState>();
      for (const d of pull.docs) {
        byKey.set(d.key, { value: d.value, rev: d.rev, updatedAt: d.updatedAt });
      }

      const pending: SyncKey[] = [];
      let failure: string | null = null;
      let adoptedFrom: string | null = null;

      for (const doc of SYNCED_DOCS) {
        await doc.whenReady();

        let remoteDoc = byKey.get(doc.key) ?? null;

        // ── One-time seed from the pre-ADR-061 settings blob ──────────────
        // An account that predates `sync_docs` has its real preferences in
        // `users.settings` and nowhere else. Treated as a remote document at
        // revision 0 so it flows through the SAME rules as any other: a
        // device with no pending change adopts it (which is exactly what the
        // old code did on load), and a device with one pushes over it and
        // creates the real row. Once that row exists this branch is dead for
        // the account, forever.
        if (!remoteDoc && doc.key === "prefs" && pull.legacySettings) {
          remoteDoc = { value: pull.legacySettings, rev: 0, updatedAt: 0 };
        }

        const local = doc.snapshot();
        const action = reconcile(local, remoteDoc);

        if (action === "idle") {
          if (remoteDoc) doc.markPushed(remoteDoc.value, remoteDoc.rev);
          continue;
        }

        if (action === "adopt" && remoteDoc) {
          const changed = doc.applyRemote(remoteDoc.value, remoteDoc.rev, remoteDoc.updatedAt);
          if (changed) {
            adoptedFrom = pull.docs.find((d) => d.key === doc.key)?.origin ?? null;
            logDiagnostic("CONVEX_DB", `Sync: adopted "${doc.key}" from another device.`);
          }
          continue;
        }

        // push
        try {
          const result = await push({ key: doc.key, value: local.value, origin: deviceId() });
          doc.markPushed(local.value, result.rev);
        } catch (err) {
          // The document stays dirty, so the retry below (or the user's next
          // change) sends it again. Surfaced rather than swallowed: a push
          // that never lands is a setting the other device never sees, and
          // the old code's one failure mode was exactly this, silently.
          failure = err instanceof Error ? err.message : String(err);
          pending.push(doc.key);
          logDiagnostic("CONVEX_DB", `Sync: pushing "${doc.key}" failed — ${failure}`);
        }
      }

      if (failure) {
        setSyncStatus({ state: "error", lastError: failure, pending });
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          void runSync();
        }, RETRY_MS);
      } else {
        setSyncStatus({
          state: "synced",
          lastSyncedAt: Date.now(),
          lastError: null,
          pending: [],
          ...(adoptedFrom ? { lastRemoteDevice: adoptedFrom } : {}),
        });
      }
    } finally {
      runningRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        void runSync();
      }
    }
  }, [push]);

  // A pull landed (first load, or another device wrote) → reconcile.
  useEffect(() => {
    if (!isAuthenticated) {
      setSyncStatus({ state: isLoading ? "connecting" : "local", pending: [] });
      return;
    }
    if (remote === undefined) {
      setSyncStatus({ state: "connecting" });
      return;
    }
    setSyncStatus({ state: "syncing" });
    void runSync();
  }, [isAuthenticated, isLoading, remote, runSync]);

  // This device changed something → debounce, then reconcile (which pushes).
  useEffect(() => {
    const off = onLocalChange((key) => {
      if (!authedRef.current) return;
      setSyncStatus({ state: "syncing", pending: [key] });
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        void runSync();
      }, PUSH_DEBOUNCE_MS);
    });
    return off;
  }, [runSync]);

  // Flush on the way out. A debounced change that the tab closes on top of is
  // a change the user made and nothing kept — `visibilitychange` is the hook
  // browsers actually honour for this (`beforeunload` is not fired on mobile
  // Safari at all, and `unload` is being removed).
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== "hidden") return;
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
      void runSync();
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [runSync]);

  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);
}
