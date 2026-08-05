// Reachability audit for everything Image Horse keeps in IndexedDB — the AUDIT
// half of the content-addressed GC item, and only that half.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS MODULE ONLY EVER READS. That is the whole point of it existing: garbage
// collection over user data with no backup is not something to run unattended,
// so the safe and genuinely useful part is measuring what a collector WOULD
// find. Three guarantees, all enforced below rather than promised:
//
//   1. Every transaction is opened "readonly". There is no put/delete/clear in
//      this file, and nothing here calls a store helper that has one.
//   2. `indexedDB.open(name)` is called with NO version argument, so it can
//      never trigger an upgrade or a schema change.
//   3. It only opens databases that `indexedDB.databases()` already reports.
//      Opening a name that does not exist CREATES an empty database — a write,
//      and a way to leave junk behind while "just auditing". Browsers without
//      `databases()` (older Safari) get a NULL result rather than a guess.
//
// It is deliberately raw IndexedDB and imports nothing from originalsStore /
// galleryManifest / editPersistence / dexie. Those modules are perfectly good,
// but they open with explicit versions and carry write paths, and an audit that
// borrows a write path is one refactor away from being a collector. This file
// cannot delete anything even if someone calls it wrong.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT REFERENCES WHAT (read out of the source, 2026-07-28)
//
// The live stores are the three hand-rolled ones. `image-horse-dexie` is the
// parallel, not-yet-adopted layer (db.ts header), so it is audited but reported
// separately rather than mixed into the live totals.
//
//   image-horse-gallery / manifest / key "current"   ← THE ROOT SET
//     { photos: PhotoEntry[], activeId }
//     PhotoEntry.originalKey  — SHA-256 into originals. REPOINTED by Apply
//                               Compression / Auto Compress.
//     PhotoEntry.uploadKey?   — the immutable upload original (A/B baseline).
//     PhotoEntry.id           — the photo id that keys edits and op logs.
//
//   image-horse-originals / originals   keyed by SHA-256 hex
//     Reachable iff some live photo's originalKey OR uploadKey equals the key.
//
//   image-horse-edits / edits   keyed "edit-<photoId>"
//     Reachable iff <photoId> is a live photo id. NOTE: a SavedEdit holds no
//     original key at all — canvas PNG + undo/redo stacks + annotations. So
//     edits are reachable by PHOTO ID, and a photo dropped from the manifest
//     strands its entire undo history. This is usually the biggest orphan
//     class by bytes, because it is the only one that stores history.
//
//   image-horse-dexie / opLogs, keyframes, oplogManifests   keyed by photoId
//     Same photo-id reachability. (The parked "keyframe GC" item.)
//
// Everything here is measured, not estimated: ArrayBuffer.byteLength and
// Blob.size are summed off the real records. JSON/structured-clone overhead for
// the non-binary fields is NOT counted, so byte figures are a floor, and the
// report says so. `navigator.storage.estimate()` is included as an independent
// cross-check on the same order of magnitude.

/** One audited object store. */
export interface ContentAuditClass {
  /** "<database>/<store>" */
  store: string;
  /** What the primary key means — decides how reachability is computed. */
  keyKind: "content-hash" | "photo-id" | "singleton";
  total: number;
  totalBytes: number;
  reachable: number;
  reachableBytes: number;
  orphans: number;
  orphanBytes: number;
  /** First N orphan keys, for spot-checking a claim by hand. */
  orphanKeySample: string[];
  /** Present when the store could not be read (absent DB, missing store). */
  unavailable?: string;
}

export interface ContentAuditReport {
  generatedAt: number;
  /** Databases `indexedDB.databases()` actually reports, or null if the
   *  browser has no such API (then nothing is opened at all). */
  databasesPresent: string[] | null;
  storageEstimate: { usage?: number; quota?: number } | null;
  roots: {
    manifestFound: boolean;
    livePhotos: number;
    distinctOriginalKeys: number;
    distinctUploadKeys: number;
    distinctRootKeys: number;
    livePhotoIds: number;
  };
  /** Evidence for the two named orphan sources. */
  findings: {
    /** Photos whose originalKey has been repointed away from their uploadKey —
     *  i.e. compression has run on them at least once. */
    photosRepointedByCompression: number;
    /** Photos carrying no uploadKey (pre-dates the A/B baseline field, so a
     *  repoint on these left nothing pointing at the upload original). */
    photosWithoutUploadKey: number;
    /** Originals present that no live photo points at, by either key. */
    orphanedOriginals: number;
    orphanedOriginalBytes: number;
    /** Edit archives whose photo id is gone from the manifest. */
    orphanedEditArchives: number;
    orphanedEditArchiveBytes: number;
  };
  classes: ContentAuditClass[];
  totals: {
    liveStoresOrphanCount: number;
    liveStoresOrphanBytes: number;
    dexieOrphanCount: number;
    dexieOrphanBytes: number;
    allOrphanBytes: number;
  };
  notes: string[];
}

// ── raw IndexedDB, read-only ────────────────────────────────────────────────

function openExisting(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    // No version argument: opens whatever exists, never upgrades.
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    // If this ever fires we are creating a database, which the caller's
    // databases() check is supposed to prevent. Abort rather than write.
    req.onupgradeneeded = () => {
      try {
        req.transaction?.abort();
      } catch {
        /* nothing sensible to do; the abort is best-effort */
      }
      resolve(null);
    };
  });
}

export interface RawEntry {
  key: string;
  value: unknown;
}

function readAll(db: IDBDatabase, store: string): Promise<RawEntry[] | null> {
  if (!db.objectStoreNames.contains(store)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const out: RawEntry[] = [];
    let tx: IDBTransaction;
    try {
      tx = db.transaction(store, "readonly");
    } catch {
      resolve(null);
      return;
    }
    const cursorReq = tx.objectStore(store).openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      out.push({ key: String(cursor.key), value: cursor.value });
      cursor.continue();
    };
    cursorReq.onerror = () => resolve(out);
    tx.onerror = () => resolve(out);
  });
}

/** Photo id out of an edits key ("edit-<photoId>"). Keys written by older code
 *  may lack the prefix, so an unprefixed key is treated as the id itself. */
export function photoIdFromEditKey(key: string): string {
  return key.startsWith("edit-") ? key.slice("edit-".length) : key;
}

/** Photo id out of a Dexie compound key. `[photoId+branch+chunkSeq]` stringifies
 *  as "photoId,branch,seq", so the id is the leading segment. A record's own
 *  `photoId` field is preferred when present — a photo id containing a comma
 *  would otherwise split wrongly. */
export function photoIdFromRow(key: string, value: unknown): string {
  const fromRecord = (value as { photoId?: unknown } | null)?.photoId;
  return typeof fromRecord === "string" ? fromRecord : (key.split(",")[0] ?? key);
}

/** Sum the binary payload of a structured-cloned record: ArrayBuffers, typed
 *  arrays and Blobs, at any depth. Strings/numbers are not counted — the report
 *  presents these figures as a floor for that reason. Depth-capped so a cyclic
 *  or pathological record can't hang the audit. */
export function measureBytes(value: unknown, depth = 0): number {
  if (value == null || depth > 6) return 0;
  if (value instanceof Blob) return value.size;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (Array.isArray(value)) {
    let n = 0;
    for (const v of value) n += measureBytes(v, depth + 1);
    return n;
  }
  if (typeof value === "object") {
    let n = 0;
    for (const v of Object.values(value as Record<string, unknown>)) {
      n += measureBytes(v, depth + 1);
    }
    return n;
  }
  return 0;
}

const ORPHAN_SAMPLE = 12;

/** Split one store's rows into reachable and orphaned, measuring both. Pure and
 *  exported so the reachability rule is unit-tested rather than only ever
 *  exercised against whatever happens to be in the browser — a detector that
 *  reports zero because it is broken looks exactly like a clean store. */
export function classifyStore(
  entries: RawEntry[],
  isReachable: (key: string, value: unknown) => boolean,
  store: string,
  keyKind: ContentAuditClass["keyKind"],
): ContentAuditClass {
  const c: ContentAuditClass = {
    store,
    keyKind,
    total: entries.length,
    totalBytes: 0,
    reachable: 0,
    reachableBytes: 0,
    orphans: 0,
    orphanBytes: 0,
    orphanKeySample: [],
  };
  for (const e of entries) {
    const bytes = measureBytes(e.value);
    c.totalBytes += bytes;
    if (isReachable(e.key, e.value)) {
      c.reachable += 1;
      c.reachableBytes += bytes;
    } else {
      c.orphans += 1;
      c.orphanBytes += bytes;
      if (c.orphanKeySample.length < ORPHAN_SAMPLE) c.orphanKeySample.push(e.key);
    }
  }
  return c;
}

function unavailable(
  store: string,
  keyKind: ContentAuditClass["keyKind"],
  why: string,
): ContentAuditClass {
  return {
    store,
    keyKind,
    total: 0,
    totalBytes: 0,
    reachable: 0,
    reachableBytes: 0,
    orphans: 0,
    orphanBytes: 0,
    orphanKeySample: [],
    unavailable: why,
  };
}

interface ManifestPhotoShape {
  id?: unknown;
  originalKey?: unknown;
  uploadKey?: unknown;
}

/**
 * Walk every store and report what a collector would find. Reads only.
 *
 * Returns a report even when nothing is there — an empty gallery is a valid
 * answer, and "the manifest is missing" is reported rather than thrown, because
 * a thrown audit tells you nothing about how much is stranded.
 */
export async function auditContentStores(): Promise<ContentAuditReport> {
  const notes: string[] = [];

  let databasesPresent: string[] | null = null;
  if (typeof indexedDB.databases === "function") {
    try {
      const list = await indexedDB.databases();
      databasesPresent = list
        .map((d) => d.name)
        .filter((n): n is string => typeof n === "string")
        .sort();
    } catch {
      databasesPresent = null;
    }
  }
  if (databasesPresent === null) {
    notes.push(
      "indexedDB.databases() is unavailable in this browser, so no database was opened: " +
        "opening a name that does not exist would CREATE it, and an audit must not write. " +
        "Run this in a Chromium-based browser for real figures.",
    );
  }

  const present = (name: string) => (databasesPresent ?? []).includes(name);

  let storageEstimate: ContentAuditReport["storageEstimate"] = null;
  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      storageEstimate = { usage: est.usage, quota: est.quota };
    } catch {
      /* estimate is a cross-check, not the measurement */
    }
  }

  // ── Roots: the gallery manifest ──────────────────────────────────────────
  const originalKeys = new Set<string>();
  const uploadKeys = new Set<string>();
  const livePhotoIds = new Set<string>();
  let manifestFound = false;
  let photosRepointedByCompression = 0;
  let photosWithoutUploadKey = 0;

  const galleryDb = present("image-horse-gallery")
    ? await openExisting("image-horse-gallery")
    : null;
  if (galleryDb) {
    const rows = await readAll(galleryDb, "manifest");
    const current = rows?.find((r) => r.key === "current");
    const photos = (current?.value as { photos?: unknown } | undefined)?.photos;
    if (Array.isArray(photos)) {
      manifestFound = true;
      for (const p of photos as ManifestPhotoShape[]) {
        if (typeof p.id === "string") livePhotoIds.add(p.id);
        const ok = typeof p.originalKey === "string" ? p.originalKey : null;
        const uk = typeof p.uploadKey === "string" ? p.uploadKey : null;
        if (ok) originalKeys.add(ok);
        if (uk) uploadKeys.add(uk);
        if (!uk) photosWithoutUploadKey += 1;
        else if (ok && ok !== uk) photosRepointedByCompression += 1;
      }
    }
    galleryDb.close();
  }
  if (!manifestFound) {
    notes.push(
      "No gallery manifest was found, so EVERY stored byte classifies as an orphan. " +
        "That is the correct reading of the root set (nothing references anything), but it is " +
        "not evidence of a leak — a session that never saved a manifest looks identical.",
    );
  }

  const rootKeys = new Set<string>([...originalKeys, ...uploadKeys]);
  const classes: ContentAuditClass[] = [];

  // ── image-horse-originals: content-addressed blobs ───────────────────────
  if (present("image-horse-originals")) {
    const db = await openExisting("image-horse-originals");
    const rows = db ? await readAll(db, "originals") : null;
    classes.push(
      rows
        ? classifyStore(rows, (key) => rootKeys.has(key), "image-horse-originals/originals", "content-hash")
        : unavailable("image-horse-originals/originals", "content-hash", "store missing or unreadable"),
    );
    db?.close();
  } else {
    classes.push(
      unavailable("image-horse-originals/originals", "content-hash", "database not present"),
    );
  }

  // ── image-horse-edits: archives keyed "edit-<photoId>" ───────────────────
  if (present("image-horse-edits")) {
    const db = await openExisting("image-horse-edits");
    const rows = db ? await readAll(db, "edits") : null;
    classes.push(
      rows
        ? classifyStore(
            rows,
            (key) => livePhotoIds.has(photoIdFromEditKey(key)),
            "image-horse-edits/edits",
            "photo-id",
          )
        : unavailable("image-horse-edits/edits", "photo-id", "store missing or unreadable"),
    );
    db?.close();
  } else {
    classes.push(unavailable("image-horse-edits/edits", "photo-id", "database not present"));
  }

  // ── image-horse-dexie: the parallel layer + op-log tables ────────────────
  const dexieStores: { store: string; keyKind: ContentAuditClass["keyKind"] }[] = [
    { store: "originals", keyKind: "content-hash" },
    { store: "workingCopies", keyKind: "photo-id" },
    { store: "photos", keyKind: "photo-id" },
    { store: "opLogs", keyKind: "photo-id" },
    { store: "keyframes", keyKind: "photo-id" },
    { store: "oplogManifests", keyKind: "photo-id" },
  ];
  if (present("image-horse-dexie")) {
    const db = await openExisting("image-horse-dexie");
    for (const { store, keyKind } of dexieStores) {
      const rows = db ? await readAll(db, store) : null;
      if (!rows) {
        classes.push(unavailable(`image-horse-dexie/${store}`, keyKind, "store missing"));
        continue;
      }
      classes.push(
        classifyStore(
          rows,
          (key, value) =>
            keyKind === "content-hash"
              ? rootKeys.has(key)
              : livePhotoIds.has(photoIdFromRow(key, value)),
          `image-horse-dexie/${store}`,
          keyKind,
        ),
      );
    }
    db?.close();
  } else {
    for (const { store, keyKind } of dexieStores) {
      classes.push(unavailable(`image-horse-dexie/${store}`, keyKind, "database not present"));
    }
  }

  const find = (store: string) => classes.find((c) => c.store === store);
  const originalsClass = find("image-horse-originals/originals");
  const editsClass = find("image-horse-edits/edits");

  const isLive = (c: ContentAuditClass) => !c.store.startsWith("image-horse-dexie/");
  const sum = (pick: (c: ContentAuditClass) => number, filter: (c: ContentAuditClass) => boolean) =>
    classes.filter(filter).reduce((n, c) => n + pick(c), 0);

  if (photosRepointedByCompression > 0) {
    notes.push(
      `${photosRepointedByCompression} live photo(s) have an originalKey that no longer matches ` +
        "their uploadKey, so compression has repointed them at least once. Each repoint leaves the " +
        "previous blob uncollected unless it happened to be the upload original.",
    );
  }
  if (photosWithoutUploadKey > 0) {
    notes.push(
      `${photosWithoutUploadKey} live photo(s) carry no uploadKey (they pre-date the A/B baseline ` +
        "field). A repoint on those left nothing at all pointing at the upload original, so its blob " +
        "is unreachable and indistinguishable from any other orphan.",
    );
  }

  return {
    generatedAt: Date.now(),
    databasesPresent,
    storageEstimate,
    roots: {
      manifestFound,
      livePhotos: livePhotoIds.size,
      distinctOriginalKeys: originalKeys.size,
      distinctUploadKeys: uploadKeys.size,
      distinctRootKeys: rootKeys.size,
      livePhotoIds: livePhotoIds.size,
    },
    findings: {
      photosRepointedByCompression,
      photosWithoutUploadKey,
      orphanedOriginals: originalsClass?.orphans ?? 0,
      orphanedOriginalBytes: originalsClass?.orphanBytes ?? 0,
      orphanedEditArchives: editsClass?.orphans ?? 0,
      orphanedEditArchiveBytes: editsClass?.orphanBytes ?? 0,
    },
    classes,
    totals: {
      liveStoresOrphanCount: sum((c) => c.orphans, isLive),
      liveStoresOrphanBytes: sum((c) => c.orphanBytes, isLive),
      dexieOrphanCount: sum((c) => c.orphans, (c) => !isLive(c)),
      dexieOrphanBytes: sum((c) => c.orphanBytes, (c) => !isLive(c)),
      allOrphanBytes: sum((c) => c.orphanBytes, () => true),
    },
    notes,
  };
}

/** Human-readable byte size, matching the status bar's style. */
export function formatAuditBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Markdown rendering of a report — what gets pasted into
 *  docs/content-addressed-gc-audit.md. Kept next to the audit so the document's
 *  shape and the analysis can't drift apart. */
export function formatAuditMarkdown(r: ContentAuditReport): string {
  const L: string[] = [];
  const b = formatAuditBytes;
  L.push(`Generated: ${new Date(r.generatedAt).toISOString()}`);
  L.push("");
  L.push(
    `Root set: ${r.roots.manifestFound ? `${r.roots.livePhotos} live photos` : "NO MANIFEST FOUND"}` +
      ` · ${r.roots.distinctRootKeys} distinct content keys referenced` +
      ` (${r.roots.distinctOriginalKeys} originalKey, ${r.roots.distinctUploadKeys} uploadKey)`,
  );
  if (r.storageEstimate?.usage != null) {
    L.push(
      `navigator.storage.estimate(): ${b(r.storageEstimate.usage)} used` +
        (r.storageEstimate.quota != null ? ` of ${b(r.storageEstimate.quota)} quota` : ""),
    );
  }
  L.push("");
  L.push("| store | key | rows | total | reachable | orphans | orphan bytes |");
  L.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const c of r.classes) {
    if (c.unavailable) {
      L.push(`| \`${c.store}\` | ${c.keyKind} | — | — | — | — | _${c.unavailable}_ |`);
      continue;
    }
    L.push(
      `| \`${c.store}\` | ${c.keyKind} | ${c.total} | ${b(c.totalBytes)} | ${c.reachable} | ` +
        `**${c.orphans}** | **${b(c.orphanBytes)}** |`,
    );
  }
  L.push("");
  L.push(
    `**Live stores: ${r.totals.liveStoresOrphanCount} orphaned rows, ${b(r.totals.liveStoresOrphanBytes)}.** ` +
      `Dexie layer: ${r.totals.dexieOrphanCount} rows, ${b(r.totals.dexieOrphanBytes)}. ` +
      `Everything: ${b(r.totals.allOrphanBytes)}.`,
  );
  L.push("");
  L.push(`- Orphaned originals: **${r.findings.orphanedOriginals}** (${b(r.findings.orphanedOriginalBytes)})`);
  L.push(
    `- Orphaned edit archives: **${r.findings.orphanedEditArchives}** (${b(r.findings.orphanedEditArchiveBytes)})`,
  );
  L.push(`- Photos repointed by compression: **${r.findings.photosRepointedByCompression}**`);
  L.push(`- Photos with no uploadKey: **${r.findings.photosWithoutUploadKey}**`);
  if (r.notes.length) {
    L.push("");
    for (const n of r.notes) L.push(`> ${n}`);
  }
  return L.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVE CORRUPTION DETECTOR (read-only, never repairs)
//
// The bug: `savePhotoEdit(photoId, toolRef)` wrote whatever document the engine
// was holding under `edit-${photoId}`, without checking the engine held that
// photo. A switch that died in saveOutgoing left the engine on the PREVIOUS
// photo, so the next save stamped that photo's canvas into a different photo's
// archive. Fixed at the source by the ownership guard (lib/engineDocument.ts);
// this measures what the unguarded builds already wrote.
//
// TWO SIGNALS, AND THEY ARE NOT EQUALLY GOOD
//
//   1. COLLISION (strong). Two or more photos whose archives share identical
//      canvas dimensions while the photos themselves are different shapes.
//      This is exactly how the bug was caught: four photos with four different
//      aspect ratios, four archives all 1445×2128. It is close to
//      false-positive-free, because independent photos landing on byte-identical
//      canvas dimensions is a coincidence, and a whole GROUP of them is not a
//      coincidence at all.
//
//   2. ASPECT DRIFT (weak, advisory). One archive whose aspect ratio does not
//      match its own photo's. Legitimate edits change this all the time — crop,
//      resize, and the artboard border all move the canvas away from the
//      photo's native shape — so this is reported as SUSPECT, never as
//      corrupt, and a clean run with drift is not a finding.
//
// WHY THIS NEVER REPAIRS. A heuristic that deletes or rewrites a user's archive
// is worse than the bug it is chasing: the bug costs one photo's edits, a wrong
// repair costs the edits it was pointed at. IndexedDB is user data with no
// backup. Detect, report, and let a human decide.

export interface ArchiveCollision {
  /** The shared canvas dimensions, e.g. "1445×2128". */
  dimensions: string;
  /** Photo ids whose archives all carry these dimensions. */
  photoIds: string[];
  /** The photos' OWN dimensions, to show they genuinely differ. */
  photoDimensions: string[];
}

export interface ArchiveDrift {
  photoId: string;
  archive: string;
  photo: string;
  /** Percent difference between archive aspect and photo aspect. */
  aspectDeltaPct: number;
}

export interface ArchiveCorruptionReport {
  manifestFound: boolean;
  photosInManifest: number;
  archivesFound: number;
  /** Archives whose photo id is not in the manifest — cannot be checked. */
  archivesWithoutPhoto: number;
  collisions: ArchiveCollision[];
  drift: ArchiveDrift[];
  /** Photos implicated by at least one collision. The headline number. */
  suspectPhotoCount: number;
  notes: string[];
}

interface ManifestDimShape {
  id?: unknown;
  workingWidth?: unknown;
  workingHeight?: unknown;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

/**
 * Compare every local edit archive's canvas dimensions against the photo it
 * claims to belong to. Reads only — opens nothing that does not already exist,
 * writes nothing, deletes nothing.
 */
export async function auditArchiveCorruption(): Promise<ArchiveCorruptionReport> {
  const notes: string[] = [];
  const empty = (why: string): ArchiveCorruptionReport => {
    notes.push(why);
    return {
      manifestFound: false,
      photosInManifest: 0,
      archivesFound: 0,
      archivesWithoutPhoto: 0,
      collisions: [],
      drift: [],
      suspectPhotoCount: 0,
      notes,
    };
  };

  if (typeof indexedDB.databases !== "function") {
    return empty(
      "indexedDB.databases() is unavailable in this browser, so no database was opened — " +
        "opening a name that does not exist would CREATE it, and an audit must not write. " +
        "Run this in a Chromium-based browser.",
    );
  }
  let names: string[];
  try {
    names = (await indexedDB.databases())
      .map((d) => d.name)
      .filter((n): n is string => typeof n === "string");
  } catch {
    return empty("indexedDB.databases() threw; nothing was opened.");
  }

  // ── The photos and their true dimensions ────────────────────────────────
  const photoDims = new Map<string, { w: number; h: number }>();
  let manifestFound = false;
  if (names.includes("image-horse-gallery")) {
    const db = await openExisting("image-horse-gallery");
    if (db) {
      const rows = await readAll(db, "manifest");
      const photos = (
        rows?.find((r) => r.key === "current")?.value as { photos?: unknown } | undefined
      )?.photos;
      if (Array.isArray(photos)) {
        manifestFound = true;
        for (const p of photos as ManifestDimShape[]) {
          const w = num(p.workingWidth);
          const h = num(p.workingHeight);
          if (typeof p.id === "string" && w && h) photoDims.set(p.id, { w, h });
        }
      }
      db.close();
    }
  }
  if (!manifestFound) {
    return empty(
      "No gallery manifest was found, so there are no true dimensions to compare against. " +
        "This is not evidence that archives are clean — it means they cannot be checked.",
    );
  }

  // ── The archives ────────────────────────────────────────────────────────
  const archives = new Map<string, { w: number; h: number }>();
  let archivesWithoutPhoto = 0;
  if (names.includes("image-horse-edits")) {
    const db = await openExisting("image-horse-edits");
    const rows = db ? await readAll(db, "edits") : null;
    if (rows) {
      for (const r of rows) {
        if (!r.key.startsWith("edit-")) continue;
        const id = photoIdFromEditKey(r.key);
        const v = r.value as { canvasW?: unknown; canvasH?: unknown } | undefined;
        const w = num(v?.canvasW);
        const h = num(v?.canvasH);
        if (!w || !h) continue;
        archives.set(id, { w, h });
        if (!photoDims.has(id)) archivesWithoutPhoto += 1;
      }
    }
    db?.close();
  }

  // ── Signal 1: collisions ────────────────────────────────────────────────
  const byDims = new Map<string, string[]>();
  for (const [id, a] of archives) {
    if (!photoDims.has(id)) continue; // uncheckable, counted separately
    const key = `${a.w}×${a.h}`;
    const list = byDims.get(key);
    if (list) list.push(id);
    else byDims.set(key, [id]);
  }

  const collisions: ArchiveCollision[] = [];
  const suspects = new Set<string>();
  for (const [dimensions, ids] of byDims) {
    if (ids.length < 2) continue;
    // Photos that are genuinely the SAME shape sharing a canvas size is
    // ordinary — a burst off one camera, edited the same way. Only flag when
    // the photos themselves differ, which is what makes one canvas impossible.
    const shapes = new Set(ids.map((id) => {
      const p = photoDims.get(id)!;
      return `${p.w}×${p.h}`;
    }));
    if (shapes.size < 2) continue;
    collisions.push({
      dimensions,
      photoIds: ids,
      photoDimensions: ids.map((id) => {
        const p = photoDims.get(id)!;
        return `${p.w}×${p.h}`;
      }),
    });
    for (const id of ids) suspects.add(id);
  }

  // ── Signal 2: aspect drift (advisory) ───────────────────────────────────
  const drift: ArchiveDrift[] = [];
  for (const [id, a] of archives) {
    const p = photoDims.get(id);
    if (!p) continue;
    const aAsp = a.w / a.h;
    const pAsp = p.w / p.h;
    const deltaPct = Math.abs(aAsp - pAsp) / pAsp * 100;
    if (deltaPct > 2) {
      drift.push({
        photoId: id,
        archive: `${a.w}×${a.h}`,
        photo: `${p.w}×${p.h}`,
        aspectDeltaPct: +deltaPct.toFixed(1),
      });
    }
  }
  drift.sort((x, y) => y.aspectDeltaPct - x.aspectDeltaPct);

  if (archivesWithoutPhoto > 0) {
    notes.push(
      `${archivesWithoutPhoto} archive(s) belong to photo ids that are no longer in the ` +
        "manifest, so they have no true dimensions to compare against and were skipped. " +
        "They are orphans for the content audit's purposes, not corruption evidence.",
    );
  }
  if (collisions.length === 0 && drift.length > 0) {
    notes.push(
      "Aspect drift with no collisions is NOT a finding on its own — crop, resize and the " +
        "artboard border all legitimately move a canvas away from its photo's native shape.",
    );
  }

  return {
    manifestFound,
    photosInManifest: photoDims.size,
    archivesFound: archives.size,
    archivesWithoutPhoto,
    collisions,
    drift,
    suspectPhotoCount: suspects.size,
    notes,
  };
}

/** Human-readable rendering of the corruption report. */
export function formatArchiveCorruptionMarkdown(r: ArchiveCorruptionReport): string {
  const L: string[] = ["# Archive corruption audit", ""];
  if (!r.manifestFound) {
    L.push("**Could not run.**", "");
    for (const n of r.notes) L.push(`> ${n}`);
    return L.join("\n");
  }
  L.push(
    `Photos in manifest: ${r.photosInManifest}`,
    `Edit archives found: ${r.archivesFound}`,
    "",
    r.suspectPhotoCount > 0
      ? `## ⚠ ${r.suspectPhotoCount} photo(s) implicated in ${r.collisions.length} collision(s)`
      : "## No collisions found",
    "",
  );
  for (const c of r.collisions) {
    L.push(`- **${c.dimensions}** shared by ${c.photoIds.length} archives:`);
    c.photoIds.forEach((id, i) => {
      L.push(`  - \`${id}\` — the photo itself is ${c.photoDimensions[i]}`);
    });
  }
  if (r.drift.length > 0) {
    L.push("", `## Aspect drift (advisory, ${r.drift.length})`, "");
    for (const d of r.drift) {
      L.push(`- \`${d.photoId}\`: archive ${d.archive} vs photo ${d.photo} (${d.aspectDeltaPct}% off)`);
    }
  }
  if (r.notes.length > 0) {
    L.push("");
    for (const n of r.notes) L.push(`> ${n}`);
  }
  return L.join("\n");
}
