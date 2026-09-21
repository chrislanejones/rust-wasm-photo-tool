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
// What lives HERE is the bookkeeping that makes the cross-tab hop and the
// cross-device hop the same thing: a value, a revision, a timestamp, and
// whether the server still owes a write. `useCloudSync` reads exactly that
// through `snapshot()` and answers with `applyRemote` / `markPushed`.
import { publish, subscribe as subscribeChannel, type DocMessage } from "./channel";
import type { LocalDocState } from "./reconcile";
import type { SyncKey } from "./keys";

export interface SyncedDocSpec<T> {
  key: SyncKey;
  /** The value the app is holding right now. */
  read: () => T;
  /** Write a value that came from another tab or another device back into the
   *  app. Must persist it and update the UI, exactly as a user edit would —
   *  minus telling this layer about it (that would be an echo). */
  adopt: (value: T) => void;
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
   *  moment later. Omit when the value is available synchronously. */
  ready?: () => Promise<void>;
}

export interface SyncedDoc {
  readonly key: SyncKey;
  /** Announce that the APP changed this document (a user edit). Serializes,
   *  and if the value actually moved: marks it dirty and hands it to the
   *  other tabs. A no-op when the serialized value is unchanged, which is
   *  what makes it safe to call from a store subscription that fires on every
   *  unrelated state change. */
  changedLocally: () => void;
  /** State for `reconcile`, plus the revision the cloud layer reports back. */
  snapshot: () => LocalDocState;
  /** Take the server's copy. Returns true when the app's value changed. */
  applyRemote: (value: string, rev: number, updatedAt: number) => boolean;
  /** Record a completed push. `pushed` is the value that was sent — the dirty
   *  flag is only cleared if the document has not moved on since. */
  markPushed: (pushed: string, rev: number) => void;
  /** Record what the app holds WITHOUT marking it dirty. Called once, by the
   *  owner, the moment the underlying store is readable — see the note on
   *  `bridge` in docs.ts. A no-op if the document already knows a value. */
  prime: () => void;
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
  // `value` is lazily primed from the app rather than at definition time: a
  // document defined at module scope would otherwise read a zustand store
  // before its persisted state has hydrated, and cache the defaults as "what
  // this device holds".
  let value: string | null = null;
  let rev = 0;
  let updatedAt = 0;
  let dirty = false;

  function current(): string {
    if (value === null) {
      value = spec.serialize(spec.read());
      updatedAt = Date.now();
    }
    return value;
  }

  function changedLocally(): void {
    const next = spec.serialize(spec.read());
    if (next === current()) return; // nothing moved — the common case
    value = next;
    updatedAt = Date.now();
    dirty = true;
    publish({ key: spec.key, value: next, updatedAt, rev, dirty: true });
    emitLocalChange(spec.key);
  }

  /** A value from a sibling TAB. Adopted wholesale, dirty flag and all: the
   *  sending tab may still owe the server this write, and if this tab drops
   *  the obligation a change made in a background tab could be shown
   *  everywhere on this device and stored nowhere. */
  function applyFromTab(msg: DocMessage): void {
    if (msg.value === current()) {
      // Same value — but the sender may know a newer revision than we do.
      if (msg.rev > rev) rev = msg.rev;
      return;
    }
    const parsed = spec.parse(msg.value);
    if (parsed === null) return; // rejected: keep ours
    value = msg.value;
    updatedAt = msg.updatedAt;
    rev = Math.max(rev, msg.rev);
    dirty = msg.dirty;
    spec.adopt(parsed);
    if (dirty) emitLocalChange(spec.key);
  }

  function applyRemote(nextValue: string, nextRev: number, nextUpdatedAt: number): boolean {
    rev = nextRev;
    if (nextValue === current()) {
      dirty = false; // the server already has what we hold
      return false;
    }
    const parsed = spec.parse(nextValue);
    if (parsed === null) return false;
    value = nextValue;
    updatedAt = nextUpdatedAt;
    // Set BEFORE `adopt`, not after: adopting can re-enter `changedLocally`
    // synchronously, and that call's `dirty = true` must survive.
    dirty = false;
    spec.adopt(parsed);

    // Hand it straight to the sibling tabs. Each of them has its own Convex
    // subscription and would get there eventually, but a background tab's
    // socket can be throttled for minutes — and this is the hop that makes
    // "switch tabs and it is already right" true rather than usually true.
    //
    // ⚠️ ANNOUNCE WHAT THE DOCUMENT HOLDS NOW, not what arrived. `adopt` can
    // move it on in the same turn, and the real case is not hypothetical: the
    // one-time seed from the legacy `users.settings` blob parses, normalizes
    // and re-serializes into the CURRENT field list, which is a different
    // string from the one the server sent. Publishing the argument here would
    // hand every sibling tab the stale pre-migration blob a moment after this
    // tab had already upgraded past it. When `adopt` did move it on,
    // `changedLocally` has already announced the newer value, so this skips.
    if (value === nextValue) {
      publish({ key: spec.key, value: nextValue, updatedAt, rev, dirty: false });
    }
    return true;
  }

  function markPushed(pushed: string, nextRev: number): void {
    if (nextRev > rev) rev = nextRev;
    // Only clear the obligation if nothing changed while the push was in
    // flight. Clearing it unconditionally drops the newer edit on the floor.
    if (pushed === current()) dirty = false;
  }

  function prime(): void {
    if (value !== null) return; // already known — priming would be a lie
    current();
  }

  const doc: SyncedDoc = {
    key: spec.key,
    changedLocally,
    prime,
    snapshot: () => ({ value: current(), rev, updatedAt, dirty }),
    applyRemote,
    markPushed,
    whenReady: () => spec.ready?.() ?? Promise.resolve(),
  };

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
