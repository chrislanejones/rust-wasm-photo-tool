// The cross-DEVICE half. One reactive Convex query carries every synced
// document for the signed-in user; one mutation sends this device's changes
// back. `reconcile` decides which of those happens, per document.
//
// There is exactly ONE place where a document is acted on — `runSync` below —
// and the things that call it: the query updating (another device wrote), a
// local change (this device wrote), auth flipping, this tab taking the tab
// claim, and a retry timer. Keeping it to one function is deliberate: every
// sync bug this design can still have is a bug in the reconcile rule, which
// is pure and enumerated in reconcile.test.ts, rather than a race between two
// effects that each thought they owned the document.
//
// ONE TAB PER DEVICE DOES THIS. Only the tab holding the tab claim (the one
// the user can edit in — leader.ts) reconciles with the server. The others
// are kept current by that tab over the cross-tab channel, and the pending
// changes they would otherwise each push live in the shared ledger.
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { logDiagnostic } from "@/lib/diagnosticsLog";
import { SYNCED_DOCS } from "./docs";
import { onLocalChange, type SyncedDoc } from "./syncedDoc";
import { reconcile, type RemoteDocState } from "./reconcile";
import { setCurrentAccount } from "./ledger";
import { holdsTabClaim, subscribeTabClaim } from "./leader";
import { useSyncEnabled } from "./enabled";
import { setSyncStatus } from "./status";
import type { SyncKey } from "./keys";

/** How long to sit on a local change before pushing it. Long enough that
 *  dragging a slider is one write rather than forty; short enough that
 *  switching to the other device at a normal human pace finds it already
 *  there. The same debounce the settings blob used before this layer. */
const PUSH_DEBOUNCE_MS = 600;

/** Backoff after a failed push: 5 s, doubling, capped at 5 minutes, reset by
 *  the next success. The failures worth surviving — a dropped connection, a
 *  cold deployment — clear in seconds; one that does not clear should not
 *  cost a request every five seconds for as long as the tab is open. */
const RETRY_FIRST_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;

/** How long one document may wait on its store's hydration before this pass
 *  goes on without it. zustand never finishes hydrating when IndexedDB is
 *  blocked, and an unbounded wait here held the pass lock forever — one stuck
 *  store stopped sync for every document. */
const READY_TIMEOUT_MS = 5_000;

/** Compare-and-set rounds per document per pass. A conflict means someone
 *  wrote between our read and our write; re-reconciling against what is
 *  actually there settles it in one round unless another device is writing
 *  the same document continuously. */
const MAX_CONFLICT_ROUNDS = 3;

type Pull = NonNullable<FunctionReturnType<typeof api.sync.pull>>;
type PushArgs = { key: string; value: string; format: number; baseRev: number };
type PushResult = FunctionReturnType<typeof api.sync.push>;
type PushRejection = Extract<PushResult, { status: "rejected" }>["reason"];

/** What a rejection means, for the one line of detail Settings shows. */
const REJECTION_TEXT: Record<PushRejection, string> = {
  "unknown-key": "This version of Image Horse is out of step with the server. Reload to update it.",
  "bad-format": "This version of Image Horse is out of step with the server. Reload to update it.",
  "too-large": "One of your synced documents is larger than the server accepts.",
  "signed-out": "The server did not recognize your sign-in. Sign in again to resume syncing.",
};

type Outcome =
  | { kind: "ok" }
  /** Still owed, and a later pull — not a timer — is what will move it. */
  | { kind: "waiting" }
  | { kind: "failed"; message: string; permanent: boolean };

/** True when the account holds nothing any device has sent: no document, or
 *  only the markers Forget leaves, and no legacy settings blob to seed from.
 *  From here nothing goes up by itself (reconcile.ts rule 1). */
function isAccountEmpty(pull: Pull): boolean {
  return pull.legacySettings === null && pull.docs.every((d) => d.value === null);
}

/** Resolve true if `p` settles within `ms`, false if it does not. */
function settlesWithin(p: Promise<void>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    p.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
}

/**
 * Reconcile ONE document against the pull, pushing if that is the answer,
 * and re-reconciling against the server's reply when a push is refused
 * because someone else wrote first.
 *
 * `rejected` remembers values the server has turned down PERMANENTLY, so a
 * retry pass does not send the same doomed write again; a new edit is a new
 * value and is tried.
 */
async function syncOne(
  doc: SyncedDoc,
  pull: Pull,
  push: (args: PushArgs) => Promise<PushResult>,
  live: boolean,
  rejected: Map<SyncKey, { value: string; message: string }>,
): Promise<Outcome> {
  const row = pull.docs.find((d) => d.key === doc.key);
  let remote: RemoteDocState | null = row
    ? { value: row.value, rev: row.rev, updatedAt: row.updatedAt, format: row.format }
    : null;

  // ── The pre-ADR-061 settings blob ──────────────────────────────────────────
  // An account that predates `sync_docs` has its real preferences in
  // `users.settings` and nowhere else. Treated as a remote document at
  // revision 0 and format 0, so it flows through the SAME rules as any other:
  // a device that has not changed anything adopts it (which is what the old
  // code did on load), and one with a pending change pushes over it and
  // creates the real row. The server stops sending it the moment the account
  // has ANY `prefs` row — live or forgotten — so it cannot resurrect after a
  // Forget. Ignored by a device that already holds a revision: it has seen a
  // real `prefs` row, which is newer than the legacy blob by definition.
  if (!remote && doc.key === "prefs" && pull.legacySettings !== null && doc.snapshot().rev === 0) {
    remote = { value: pull.legacySettings, rev: 0, updatedAt: 0, format: 0 };
  }

  for (let round = 0; round < MAX_CONFLICT_ROUNDS; round++) {
    const local = doc.snapshot();
    const raw = remote?.value ?? null;
    // Compare what the server holds as THIS build reads it: a blob from
    // another build that differs only in fields this one does not have is
    // agreement, not a change to adopt.
    const action = reconcile(local, remote && { ...remote, value: raw === null ? null : doc.canonical(raw) });

    if (action === "hold") return local.dirty ? { kind: "waiting" } : { kind: "ok" };

    if (action === "idle") {
      doc.markIdle(remote?.rev ?? 0);
      return { kind: "ok" };
    }

    if (action === "adopt") {
      if (remote && raw !== null && doc.applyRemote(raw, remote.rev, { live })) {
        logDiagnostic("CONVEX_DB", `Sync: took "${doc.key}" from another device.`);
      }
      return { kind: "ok" };
    }

    // push
    const refused = rejected.get(doc.key);
    if (refused && refused.value === local.value) {
      return { kind: "failed", message: refused.message, permanent: true };
    }

    let result: PushResult;
    try {
      result = await push({
        key: doc.key,
        value: local.value,
        format: doc.format,
        baseRev: remote?.rev ?? 0,
      });
    } catch (err) {
      // A thrown error is the transport — offline, a cold deployment, a
      // function not deployed yet. Transient: the change stays owed (and
      // survives a reload, see ledger.ts) and is retried on the backoff.
      return {
        kind: "failed",
        message: err instanceof Error ? err.message : String(err),
        permanent: false,
      };
    }

    if (result.status === "stored" || result.status === "unchanged") {
      // The reply carries the new revision, and recording it here is what
      // makes the pull that is STILL on screen — the one from before this
      // push — read as stale (reconcile rule 2) instead of as a newer value
      // to adopt. Without it the rerun that follows a push reverted the
      // change it had just sent, until the query caught up.
      doc.markPushed(local.value, result.rev);
      return { kind: "ok" };
    }

    if (result.status === "rejected") {
      const message = REJECTION_TEXT[result.reason];
      rejected.set(doc.key, { value: local.value, message });
      return { kind: "failed", message, permanent: true };
    }

    // Conflict: someone wrote since the revision this push was based on — a
    // queued offline mutation replayed late, or another device quicker off
    // the mark. Decide again against what is actually there now.
    remote = result.current;
  }

  return {
    kind: "failed",
    message: `"${doc.key}" kept changing on another device while this one was sending.`,
    permanent: false,
  };
}

/**
 * Drive the cloud half of the sync layer. Mount ONCE per tab, at the
 * composition root (`SyncProvider`).
 */
export function useCloudSync(): void {
  const { isAuthenticated, isLoading } = useConvexAuth();
  // The person's switch for this device (enabled.ts). Off, the query is not
  // even subscribed: the device neither fetches the account's copy nor sends.
  const enabled = useSyncEnabled();
  const remote = useQuery(api.sync.pull, isAuthenticated && enabled ? {} : "skip");
  const push = useMutation(api.sync.push);
  const leader = useSyncExternalStore(subscribeTabClaim, holdsTabClaim, holdsTabClaim);

  // The latest pull, read inside async work that may outlive the render it
  // started in. Typed by INFERENCE from the query (see `Pull`), so a field
  // added or renamed in convex/sync.ts is a typecheck error here.
  const remoteRef = useRef(remote);
  remoteRef.current = remote;
  const authedRef = useRef(false);
  authedRef.current = isAuthenticated;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const runningRef = useRef(false);
  const rerunRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failuresRef = useRef(0);
  /** Documents already reconciled in this session (this load, or since this
   *  tab took the claim). The first reconcile of each is "at load" and may
   *  change anything; later ones are adopted into a running session and hold
   *  back navigation-like fields — see `AdoptContext`. */
  const settledRef = useRef(new Set<SyncKey>());
  /** Documents whose store missed the hydration deadline, already waited on. */
  const lateRef = useRef(new Set<SyncKey>());
  const rejectedRef = useRef(new Map<SyncKey, { value: string; message: string }>());
  const accountRef = useRef<string | null>(null);
  const runRef = useRef<() => Promise<void>>(async () => {});

  const clearTimers = useCallback(() => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    pushTimerRef.current = null;
    retryTimerRef.current = null;
  }, []);

  const runSync = useCallback(async () => {
    if (!authedRef.current || !enabledRef.current) return;
    const pull = remoteRef.current;
    if (pull === undefined) return; // still loading — never push into the dark
    if (pull === null) return; // the users row is not created yet

    // Every tab records who is signed in: it is what a local edit in ANY tab
    // is filed under (ledger.ts), whichever tab ends up sending it.
    setCurrentAccount(pull.account);
    if (accountRef.current !== pull.account) {
      // A different account: nothing this tab was refused for the last one
      // says anything about this one.
      accountRef.current = pull.account;
      rejectedRef.current.clear();
    }
    if (!holdsTabClaim()) return;

    // Serialize passes. Each pass awaits store hydration and a network
    // round-trip; two overlapping passes would both read the same dirty
    // document and push it twice.
    if (runningRef.current) {
      rerunRef.current = true;
      return;
    }
    runningRef.current = true;

    try {
      const pending: SyncKey[] = [];
      let transient: string | null = null;
      let permanent: string | null = null;

      for (const doc of SYNCED_DOCS) {
        if (!(await settlesWithin(doc.whenReady(), READY_TIMEOUT_MS))) {
          // Its store has not loaded (blocked IndexedDB never does). Skip it
          // THIS pass — reconciling it now would adopt into, or push, the
          // constructed defaults — and come back if it ever does load.
          if (!lateRef.current.has(doc.key)) {
            lateRef.current.add(doc.key);
            logDiagnostic("CONVEX_DB", `Sync: "${doc.key}" is not loaded yet; syncing the rest.`);
            void doc.whenReady().then(() => {
              lateRef.current.delete(doc.key);
              void runRef.current();
            });
          }
          continue;
        }

        const live = settledRef.current.has(doc.key);
        const outcome = await syncOne(doc, pull, push, live, rejectedRef.current);
        settledRef.current.add(doc.key);

        if (outcome.kind === "waiting") pending.push(doc.key);
        if (outcome.kind === "failed") {
          pending.push(doc.key);
          logDiagnostic("CONVEX_DB", `Sync: sending "${doc.key}" failed — ${outcome.message}`);
          if (outcome.permanent) permanent = outcome.message;
          else transient = outcome.message;
        }
      }

      if (!holdsTabClaim()) {
        // The claim moved while this pass was out: the other tab reports now.
        setSyncStatus({ state: "standby", pending: [] });
      } else if (transient) {
        // Backoff, not a fixed beat. Only for failures that can clear on
        // their own: a permanent refusal is not retried on a timer at all.
        const delay = Math.min(RETRY_FIRST_MS * 2 ** failuresRef.current, RETRY_MAX_MS);
        failuresRef.current += 1;
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          void runRef.current();
        }, delay);
        setSyncStatus({ state: "error", lastError: transient, willRetry: true, pending });
      } else if (permanent) {
        failuresRef.current = 0;
        setSyncStatus({ state: "error", lastError: permanent, willRetry: false, pending });
      } else {
        failuresRef.current = 0;
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
        setSyncStatus({
          state: "synced",
          lastSyncedAt: Date.now(),
          lastError: null,
          willRetry: false,
          pending,
        });
      }
    } finally {
      runningRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        // Safe to run straight away even though React may not have re-rendered
        // with the pull that reflects this pass's pushes: every push recorded
        // its new revision, so the old pull reads as stale (reconcile rule 2).
        void runRef.current();
      }
    }
  }, [push]);
  runRef.current = runSync;

  // Taking the tab claim starts a SESSION: the next reconcile of each document
  // is "at load" again. Losing it stops this tab talking to the server — the
  // tab that took it does that now.
  useEffect(() => {
    if (leader) {
      settledRef.current.clear();
    } else {
      clearTimers();
    }
  }, [leader, clearTimers]);

  // Turning sync back on is a fresh start, like a load: every document is "at
  // load" again, and nothing refused before says anything now. Turning it off
  // stops the timers — the switch has already dropped what was owed.
  useEffect(() => {
    if (enabled) {
      settledRef.current.clear();
      rejectedRef.current.clear();
      failuresRef.current = 0;
    } else {
      clearTimers();
    }
  }, [enabled, clearTimers]);

  // A pull landed (first load, or another device wrote), auth changed, or the
  // claim moved → reconcile.
  useEffect(() => {
    if (!isAuthenticated) {
      // Signed out, for certain: nothing edited from here on is owed to any
      // account. (While auth is still LOADING the last account stays, so an
      // edit in the first second of a signed-in session is not orphaned.)
      if (!isLoading) {
        setCurrentAccount(null);
        accountRef.current = null;
      }
      setSyncStatus({
        state: !enabled ? "off" : isLoading ? "connecting" : "local",
        pending: [],
        accountEmpty: false,
      });
      return;
    }
    if (!enabled) {
      // Signed in, switched off: as signed out, for the sync layer. The switch
      // already cleared the account (enabled.ts); keep it cleared.
      accountRef.current = null;
      setSyncStatus({ state: "off", pending: [], accountEmpty: false });
      return;
    }
    if (remote === undefined || remote === null) {
      setSyncStatus({ state: "connecting", accountEmpty: false });
      return;
    }
    const accountEmpty = isAccountEmpty(remote);
    if (!leader) {
      setCurrentAccount(remote.account);
      setSyncStatus({ state: "standby", pending: [], accountEmpty });
      return;
    }
    setSyncStatus({ state: "syncing", accountEmpty });
    void runSync();
  }, [isAuthenticated, isLoading, enabled, remote, leader, runSync]);

  // This device changed something → debounce, then reconcile (which pushes).
  useEffect(() => {
    const off = onLocalChange((key) => {
      if (!authedRef.current || !enabledRef.current || !holdsTabClaim()) return;
      setSyncStatus({ state: "syncing", pending: [key] });
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        pushTimerRef.current = null;
        void runRef.current();
      }, PUSH_DEBOUNCE_MS);
    });
    return off;
  }, []);

  // Flush on the way out. A debounced change that the tab closes on top of is
  // still owed (the ledger keeps it), but sending it now means the other
  // device has it without waiting for this one to come back. `visibilitychange`
  // is the hook browsers actually honor for this (`beforeunload` is not fired
  // on mobile Safari at all, and `unload` is being removed).
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== "hidden") return;
      if (!holdsTabClaim()) return;
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
      void runRef.current();
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);
}

/**
 * "Send this device's settings to my account": owe the account every document
 * as this device holds it now, as if each had just been set here. The cloud
 * layer then pushes them on its usual debounce, and every other signed-in
 * device takes them.
 *
 * The one way a device that has not changed anything becomes the source.
 * Nothing does it automatically — see reconcile.ts rule 1 for why an account
 * is never seeded from whichever device happened to be online — so it is a
 * button the person presses, on the device they mean.
 *
 * Waits for each store to finish loading (bounded, like a sync pass): owing a
 * store's constructed defaults would send exactly the "never-used browser"
 * values rule 1 exists to keep out.
 */
export async function sendThisDevice(): Promise<void> {
  for (const doc of SYNCED_DOCS) {
    if (await settlesWithin(doc.whenReady(), READY_TIMEOUT_MS)) doc.owe();
  }
}
