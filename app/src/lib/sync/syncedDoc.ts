// A synced document: one named blob of app state that every tab and every
// signed-in device should agree on.
//
// A document owns THREE things and nothing else:
//   • the canonical serialization of its value (so two devices that agree
//     produce byte-identical strings),
//   • a validator for a value arriving from somewhere else,
//   • the hooks to read the app's copy and to write one back into it.
// Where the value is stored (localStorage, IndexedDB, a zustand store) is the
// caller's business — `docs.ts` supplies that per document.
//
// What lives HERE is the glue that makes the cross-tab hop and the
// cross-device hop the same thing: the canonical string this tab holds, and
// the per-account bookkeeping in ledger.ts (revision, pending change, first
// contact). `useCloudSync` reads exactly that through `snapshot()` and answers
// with `applyRemote` / `markPushed` / `markIdle`.
//
// ── ADOPTING IS NEVER AN EDIT ────────────────────────────────────────────────
// A value that arrives from another tab or another device is written into the
// app, and the app's own change listeners fire — which call `changedLocally`.
// That call is IGNORED while an adoption is in progress, and the document then
// records whatever the app holds afterwards, re-serialized by this build. The
// alternative, letting the listener compare, meant that any blob whose
// re-serialization differed from the wire string (another build's field list,
// a legacy blob) counted as a local change: marked dirty, re-published, and
// adopted by the other side, which re-serialized it back. Two builds with
// different serializers traded the same value forever — tens of thousands of
// adopts per tab in half a second.
import { publish, subscribe as subscribeChannel, type DocMessage } from "./channel";
import { currentAccount, readEntry, updateEntry, EMPTY_ENTRY, type LedgerEntry } from "./ledger";
import type { LocalDocState } from "./reconcile";
import type { SyncKey } from "./keys";

export interface AdoptContext {
  /** True when a person may be in the middle of something in this tab: the
   *  value came from ANOTHER DEVICE while this tab's session was already under
   *  way. A document may then hold back the fields that would change what the
   *  user is doing right now — which mode the next stroke uses, which panel is
   *  open — until the next load. False for a value from a sibling tab (the
   *  receiver is parked behind "Use Image Horse here?" while the sender edits)
   *  and for the first reconcile after a load or after taking the tab claim. */
  live: boolean;
}

export interface SyncedDocSpec<T> {
  key: SyncKey;
  /** Version of this document's WIRE FORMAT: its field list and what each
   *  field means. Bump it when either changes. It travels with the blob on
   *  both hops — a tab on another format ignores the message, and the server
   *  never lets a build write over a newer format's row — so a blob from
   *  another build is a deliberate decision, not whatever `parse` makes of it. */
  format: number;
  /** The value the app is holding right now. */
  read: () => T;
  /** Write a value that came from another tab or another device back into the
   *  app. Must persist it and update the UI, exactly as a user edit would. Any
   *  `changedLocally` it triggers is ignored — see the note at the top. */
  adopt: (value: T, context: AdoptContext) => void;
  /** Canonical JSON: an EXPLICIT field order, so the string is stable across
   *  builds and across devices. `JSON.stringify(obj)` of a literal happens to
   *  be stable today and stops being so the moment a key is added in the
   *  middle of the type. */
  serialize: (value: T) => string;
  /** Parse + validate a blob from elsewhere. Return `null` to reject it: the
   *  blob is same-origin-writable storage on the sending side and an older
   *  build's schema on the wire, so it is never trusted into app state
   *  unchecked. A rejected blob leaves this device on its own value. */
  parse: (json: string) => T | null;
  /** Resolves when the store behind this document has finished loading. The
   *  zustand documents hydrate from IndexedDB asynchronously, and adopting a
   *  remote value before that lands would be overwritten by the hydration a
   *  moment later. Omit when the value is available synchronously — the
   *  document then records it the moment it is defined. */
  ready?: () => Promise<void>;
}

export interface SyncedDoc {
  readonly key: SyncKey;
  readonly format: number;
  /** Announce that the APP changed this document (a user edit). Serializes,
   *  and if the value actually moved: records the pending change for the
   *  signed-in account and hands the value to the other tabs. A no-op when the
   *  serialized value is unchanged, which is what makes it safe to call from a
   *  store subscription that fires on every unrelated state change. */
  changedLocally: () => void;
  /** State for `reconcile`, for the account currently signed in. */
  snapshot: () => LocalDocState;
  /** A blob from the server, re-serialized through this build's parser — or
   *  null when this build cannot read it. What `reconcile` compares. */
  canonical: (json: string) => string | null;
  /** Take the server's copy. Returns true when the app's value changed. */
  applyRemote: (value: string, rev: number, context: AdoptContext) => boolean;
  /** Record a completed push. `pushed` is the value that was sent — the
   *  pending flag is only cleared if the document has not moved on since. */
  markPushed: (pushed: string, rev: number) => void;
  /** Record agreement with the server at `rev` without adopting anything —
   *  and drop any pending change (see `reconcile`, rules 1, 4 and 5). */
  markIdle: (rev: number) => void;
  /** Record what the app holds WITHOUT counting it as a change. Called by the
   *  owner the moment the underlying store is readable — see `bridge` in
   *  docs.ts. A no-op if the document already knows a value. */
  prime: () => void;
  /** Owe the signed-in account the value the app holds NOW, exactly as if the
   *  user had just set it — the "Send this device's settings" button. Marks
   *  the document met (`seen`), because a person pressing that button has
   *  decided this device is the source; first contact would adopt instead.
   *  A no-op signed out: it is owed to nobody. */
  owe: () => void;
  /** Ready gate; see `SyncedDocSpec.ready`. */
  whenReady: () => Promise<void>;
}

/** Fires whenever any document changes locally — the cloud layer's cue to
 *  schedule a push. Module-level rather than per-document so `useCloudSync`
 *  subscribes once instead of once per key. */
type LocalChangeListener = (key: SyncKey) => void;
const localChangeListeners = new Set<LocalChangeListener>();

export function onLocalChange(listener: LocalChangeListener): () => void {
  localChangeListeners.add(listener);
  return () => {
    localChangeListeners.delete(listener);
  };
}

function emitLocalChange(key: SyncKey): void {
  for (const listener of localChangeListeners) listener(key);
}

export function defineSyncedDoc<T>(spec: SyncedDocSpec<T>): SyncedDoc {
  // The canonical string this tab holds. Primed lazily for a document with a
  // ready gate — reading a zustand store before its persisted state has
  // hydrated would cache the defaults as "what this device holds" — and
  // eagerly for one without (bottom of this function).
  let value: string | null = null;
  let adopting = false;

  function current(): string {
    if (value === null) value = spec.serialize(spec.read());
    return value;
  }

  function entry(): LedgerEntry {
    const account = currentAccount();
    return account ? readEntry(account, spec.key) : EMPTY_ENTRY;
  }

  /** Owed to the signed-in account only while the app still holds exactly the
   *  value it is owed — see "PENDING IS A VALUE" in ledger.ts. Compared as
   *  THIS build reads it too, so a change recorded by an older build (whose
   *  serializer had fewer fields) is still owed after the reload that brought
   *  this one; see the note on formats in reconcile.ts. */
  function isDirty(e: LedgerEntry): boolean {
    if (e.pending === null) return false;
    return e.pending === current() || canonical(e.pending) === current();
  }

  /** Bookkeeping is only ever written for a signed-in account. A change made
   *  signed out is owed to nobody — it is not quietly sent into whichever
   *  account signs in next. */
  function update(fn: (prev: LedgerEntry) => LedgerEntry): void {
    const account = currentAccount();
    if (account) updateEntry(account, spec.key, fn);
  }

  function changedLocally(): void {
    if (adopting) return; // see "ADOPTING IS NEVER AN EDIT" above
    const next = spec.serialize(spec.read());
    if (next === current()) return; // nothing moved — the common case
    value = next;
    const now = Date.now();
    update((e) => ({ ...e, pending: next, updatedAt: now }));
    publish({ key: spec.key, format: spec.format, value: next });
    emitLocalChange(spec.key);
  }

  function adoptInto(parsed: T, context: AdoptContext): void {
    adopting = true;
    try {
      spec.adopt(parsed, context);
    } finally {
      adopting = false;
    }
    // Record what the app holds NOW, in this build's serialization — not the
    // string that arrived. They differ whenever the sender's build had another
    // field list, and this is the value everything downstream compares with.
    value = spec.serialize(spec.read());
  }

  /** A value from a sibling TAB. The pending-change bookkeeping is not in the
   *  message: the sender already wrote it to the shared ledger, so this tab
   *  just takes the value — and, if the change is still owed, tells the cloud
   *  layer, in case this is the tab that does the sending. */
  function applyFromTab(msg: DocMessage): void {
    // A tab on another build (left open across a deploy) speaks another
    // format. Its blob is not guessed at: this tab keeps its own value, and
    // the two meet again on the next load, on the same build.
    if (msg.format !== spec.format) return;
    if (msg.value === current()) return;
    const parsed = spec.parse(msg.value);
    if (parsed === null) return; // rejected: keep ours
    adoptInto(parsed, { live: false });
    if (isDirty(entry())) emitLocalChange(spec.key);
  }

  function canonical(json: string): string | null {
    const parsed = spec.parse(json);
    return parsed === null ? null : spec.serialize(parsed);
  }

  function applyRemote(nextValue: string, nextRev: number, context: AdoptContext): boolean {
    const parsed = spec.parse(nextValue);
    if (parsed === null) return false;
    const changed = spec.serialize(parsed) !== current();
    if (changed) adoptInto(parsed, context);
    update((e) => ({ ...e, rev: nextRev, pending: null, seen: true }));

    // Hand it straight to the sibling tabs. Only the tab holding the tab
    // claim talks to the server (leader.ts), so this is how the parked tabs
    // stay current — and the reason "Use here" finds them already right.
    // Announces what the document holds NOW, after adopt, for the reason given
    // in `adoptInto`.
    if (changed) publish({ key: spec.key, format: spec.format, value: current() });
    return changed;
  }

  function markPushed(pushed: string, nextRev: number): void {
    // Only clear the obligation if nothing changed while the push was in
    // flight. Clearing it unconditionally drops the newer edit on the floor.
    update((e) => ({
      ...e,
      rev: nextRev,
      seen: true,
      pending: e.pending === pushed ? null : e.pending,
    }));
  }

  function markIdle(nextRev: number): void {
    update((e) => ({ ...e, rev: nextRev, seen: true, pending: null }));
  }

  function prime(): void {
    if (value !== null) return; // already known — priming would be a lie
    current();
  }

  function owe(): void {
    if (!currentAccount()) return;
    const now = Date.now();
    update((e) => ({ ...e, pending: current(), updatedAt: now, seen: true }));
    emitLocalChange(spec.key);
  }

  const doc: SyncedDoc = {
    key: spec.key,
    format: spec.format,
    changedLocally,
    prime,
    owe,
    snapshot: () => {
      const e = entry();
      return {
        value: current(),
        format: spec.format,
        rev: e.rev,
        updatedAt: e.updatedAt,
        seen: e.seen,
        dirty: isDirty(e),
      };
    },
    canonical,
    applyRemote,
    markPushed,
    markIdle,
    whenReady: () => spec.ready?.() ?? Promise.resolve(),
  };

  // A document with no ready gate is readable NOW, so it records its value
  // now. Left lazy, its first read happened inside the first `changedLocally`
  // — AFTER the edit — so the first change in a tab compared against itself:
  // never published to the other tabs, never marked as owed, and then adopted
  // away by the next pull. That was `prefs`, the one document without a gate.
  if (!spec.ready) prime();

  // One channel subscription per document, for the lifetime of the module.
  // Documents are defined once at module scope and never torn down, so there
  // is nothing to unsubscribe — and nothing that would leak if there were.
  subscribeChannel((msg) => {
    if (msg.key !== spec.key) return;
    // Behind the ready gate, like everything else that touches `value`. A
    // message that arrives during boot must not prime this document from a
    // store that has not finished reading its own persisted state — the
    // hydration landing a moment later would then look like a local edit.
    void doc.whenReady().then(() => applyFromTab(msg));
  });

  return doc;
}
