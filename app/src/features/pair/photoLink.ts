// Photos over the pairing's data channel (ADR-105, "Sending"). Pure: a channel
// in, events out, the import injected. No React, no store, no engine, and no
// server: once two devices are paired, nothing here talks to anyone but the
// other device.
//
//   sender                                              receiver
//   offer {from, files: [{name, type, bytes, sha256}]} ──▶ checks the limits AGAIN
//                                                          (a sender can lie), and
//                                                          its gallery's room; asks
//   ◀── accept {take: [indices]}   or   decline {reason}
//   file {index} · 16 KB chunks · file-end {index}   ──▶  hashes the bytes; a match
//   …one file at a time, the send buffer kept under       goes through the normal
//   1 MB (bufferedamountlow)…                             import, a mismatch is dropped
//   done                                              ──▶
//   ◀── finished {added, failed}
//
//   cancel, from either side, at any point. A closed channel is a disconnect.
//   Either way the file in flight is thrown away; files already checked stay.
import { uploadContentType } from "@/features/transfer/send";
import { PAIR_BATCH_MAX, cleanName, fileRefusal, peerLabel, type PeerLabel } from "./limits";
import type { PairRole } from "./pairStore";

/** One data-channel message of photo bytes. 16 KB is the size every browser's
 *  SCTP stack takes without splitting or refusing. */
export const PAIR_CHUNK_BYTES = 16 * 1024;
/** Stop handing the channel chunks while this much is waiting to go out… */
export const PAIR_HIGH_WATER = 1024 * 1024;
/** …and start again once it is down to this (`bufferedamountlow`). */
const PAIR_LOW_WATER = 256 * 1024;
/** How much of a file is read from disk at a time. */
const READ_SLICE = 1024 * 1024;
/** A progress event every this many chunks (256 KB), not every chunk. */
const PROGRESS_EVERY = 16;

const HEX64 = /^[0-9a-f]{64}$/;

/** What the protocol needs of an RTCDataChannel. */
export interface WireChannel {
  readonly readyState: string;
  readonly bufferedAmount: number;
  bufferedAmountLowThreshold: number;
  binaryType: string;
  send(data: string | ArrayBuffer): void;
  addEventListener(type: string, fn: (e: MessageEvent) => void): void;
  removeEventListener(type: string, fn: (e: MessageEvent) => void): void;
}

export interface ManifestEntry {
  name: string;
  type: string;
  bytes: number;
  sha256: string;
}

export interface Skipped {
  index: number;
  name: string;
  reason: string;
}

export interface Failed {
  name: string;
  error: string;
}

export type DeclineReason = "declined" | "busy" | "full" | "refused";
export type Dir = "in" | "out";
export type Outcome = "done" | "declined" | "canceled" | "disconnected" | "refused";

/** The receiver's question: what was offered, and what it can take. */
export interface IncomingOffer {
  id: string;
  from: PeerLabel;
  files: ManifestEntry[];
  /** Indices it will ask for: those within the limits, up to the room. */
  take: number[];
  /** Left out by the limits, with the reason. */
  skipped: Skipped[];
  /** Within the limits, but the gallery has no room for them. */
  noRoom: number;
  /** Bytes in `take`. */
  bytes: number;
}

export type LinkEvent =
  /** Receiver: ask the person (accept / decline). */
  | { kind: "incoming"; offer: IncomingOffer }
  /** Sender: hashing the files before the manifest goes. */
  | { kind: "preparing"; files: number; bytes: number }
  /** Sender: the manifest went; waiting for the answer. */
  | { kind: "offered"; files: number; bytes: number }
  | {
      kind: "progress";
      dir: Dir;
      /** 1-based position of the file in flight, of `files`. */
      file: number;
      files: number;
      name: string;
      fileBytes: number;
      fileDone: number;
      totalBytes: number;
      totalDone: number;
    }
  | {
      kind: "end";
      dir: Dir;
      outcome: Outcome;
      /** Who canceled. */
      by?: "me" | "them";
      /** Declined: the receiver's reason code. Refused: a sentence. */
      reason?: string;
      added: number;
      failed: Failed[];
      /** How many were in the manifest. */
      offered: number;
      /** How many the receiving gallery had no room for. */
      noRoom: number;
    };

export type ImportResult = { ok: true } | { ok: false; message: string };

export interface LinkDeps {
  channel: WireChannel;
  /** This device's label, as the other side will show it. */
  from: PeerLabel;
  /** The OTHER side's role, to check the label it sends. */
  peerRole: PairRole;
  /** How many more photos this gallery takes right now. */
  room: () => number;
  /** The normal import: one checked file into this device's gallery. */
  importFile: (file: File) => Promise<ImportResult>;
  emit: (e: LinkEvent) => void;
}

type Wire =
  | { t: "offer"; v: 1; id: string; from: unknown; files: unknown }
  | { t: "accept"; id: string; take: unknown }
  | { t: "decline"; id: string; reason: unknown }
  | { t: "file"; id: string; index: number }
  | { t: "file-end"; id: string; index: number }
  | { t: "done"; id: string }
  | { t: "finished"; id: string; added: unknown; failed: unknown }
  | { t: "cancel"; id: string };

const KINDS = new Set(["offer", "accept", "decline", "file", "file-end", "done", "finished", "cancel"]);

/** A message off the wire, or null for anything that is not one. */
function parseWire(s: string): Wire | null {
  let v: unknown;
  try {
    v = JSON.parse(s);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const m = v as Record<string, unknown>;
  if (typeof m.t !== "string" || !KINDS.has(m.t)) return null;
  if (typeof m.id !== "string" || m.id.length > 64) return null;
  if ((m.t === "file" || m.t === "file-end") && !Number.isInteger(m.index)) return null;
  return m as unknown as Wire;
}

const MALFORMED = "The list of photos it sent didn't make sense.";

/** The manifest, checked as if the sender lied. Refused whole when it is not
 *  a manifest or offers more than a batch; otherwise each file that breaks a
 *  limit is left out with the reason. */
function checkManifest(
  files: unknown,
): { ok: false; reason: string } | { ok: true; entries: ManifestEntry[]; skipped: Skipped[] } {
  if (!Array.isArray(files) || files.length === 0) return { ok: false, reason: MALFORMED };
  if (files.length > PAIR_BATCH_MAX) {
    return { ok: false, reason: `It offered ${files.length} photos, over the ${PAIR_BATCH_MAX} a batch.` };
  }
  const entries: ManifestEntry[] = [];
  const skipped: Skipped[] = [];
  for (const [index, raw] of files.entries()) {
    if (!raw || typeof raw !== "object") return { ok: false, reason: MALFORMED };
    const e = raw as Record<string, unknown>;
    if (
      typeof e.name !== "string" ||
      e.name.length > 1000 ||
      typeof e.type !== "string" ||
      e.type.length > 100 ||
      typeof e.bytes !== "number" ||
      !Number.isSafeInteger(e.bytes) ||
      e.bytes < 0 ||
      typeof e.sha256 !== "string" ||
      !HEX64.test(e.sha256)
    ) {
      return { ok: false, reason: MALFORMED };
    }
    const entry = { name: cleanName(e.name), type: e.type, bytes: e.bytes, sha256: e.sha256 };
    entries.push(entry);
    const why = fileRefusal({ name: entry.name, type: entry.type, size: entry.bytes });
    if (why) skipped.push({ index, name: entry.name, reason: why });
  }
  return { ok: true, entries, skipped };
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", buf));
}

function newId(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(8)).buffer);
}

const CHANGED = "It changed on the way (the check didn't match), so it was dropped.";
const WRONG_SIZE = "It was a different size than it said, so it was dropped.";
const NEVER_ARRIVED = "It never arrived.";

interface Outgoing {
  id: string;
  files: File[];
  bytes: number;
  take: number[] | null;
  finished: { added: number; failed: Failed[] } | null;
}

interface Piece {
  index: number;
  /** Not one this side asked for: read past it. */
  skip: boolean;
  chunks: ArrayBuffer[];
  got: number;
  bad: boolean;
}

interface Incoming {
  id: string;
  from: PeerLabel;
  entries: ManifestEntry[];
  take: number[];
  noRoom: number;
  bytes: number;
  receiving: boolean;
  pending: Set<number>;
  cur: Piece | null;
  done: number;
  added: number;
  failed: Failed[];
  /** Checks and imports, one file at a time, in order. */
  queue: Promise<void>;
  chunksSeen: number;
}

/** One end of the photo protocol on one data channel. One transfer at a time,
 *  in either direction. */
export class PhotoLink {
  private out: Outgoing | null = null;
  private inn: Incoming | null = null;
  private closed = false;
  private wake: (() => void) | null = null;
  private readonly onMessage = (e: MessageEvent) => this.receive(e.data);
  private readonly onClose = () => this.lost();
  private readonly onLow = () => this.poke();

  constructor(private readonly deps: LinkDeps) {
    const ch = deps.channel;
    ch.binaryType = "arraybuffer";
    ch.bufferedAmountLowThreshold = PAIR_LOW_WATER;
    ch.addEventListener("message", this.onMessage);
    ch.addEventListener("close", this.onClose);
    ch.addEventListener("bufferedamountlow", this.onLow);
  }

  /** Sending or receiving (including the question). */
  get busy(): boolean {
    return this.out !== null || this.inn !== null;
  }

  /** Stop listening. A transfer still running ends as a disconnect. */
  dispose(): void {
    const ch = this.deps.channel;
    ch.removeEventListener("message", this.onMessage);
    ch.removeEventListener("close", this.onClose);
    ch.removeEventListener("bufferedamountlow", this.onLow);
    this.lost();
  }

  // ── sending ────────────────────────────────────────────────────────────────

  /** Offer `files`, and send whichever the other side asks for. Resolves when
   *  the transfer has ended, however it ended (the "end" event says how). The
   *  caller checks the limits first (limits.checkPicked); this refuses what
   *  breaks them anyway. */
  async send(files: readonly File[]): Promise<void> {
    if (this.closed) throw new Error("The devices are no longer connected.");
    if (this.busy) throw new Error("Photos are already moving. Wait for them to finish.");
    if (files.length === 0 || files.length > PAIR_BATCH_MAX) throw new Error(`Send 1 to ${PAIR_BATCH_MAX} photos at a time.`);
    for (const f of files) {
      const why = fileRefusal(f);
      if (why) throw new Error(`${f.name}: ${why}`);
    }
    const out: Outgoing = {
      id: newId(),
      files: [...files],
      bytes: files.reduce((n, f) => n + f.size, 0),
      take: null,
      finished: null,
    };
    this.out = out;
    this.deps.emit({ kind: "preparing", files: files.length, bytes: out.bytes });

    const entries: ManifestEntry[] = [];
    for (const f of out.files) {
      const sha256 = await sha256Hex(await f.arrayBuffer());
      if (this.out !== out) return;
      entries.push({ name: cleanName(f.name), type: uploadContentType(f), bytes: f.size, sha256 });
    }
    if (!this.post({ t: "offer", v: 1, id: out.id, from: this.deps.from, files: entries })) return;
    this.deps.emit({ kind: "offered", files: files.length, bytes: out.bytes });

    await this.until(() => this.out !== out || out.take !== null);
    if (this.out !== out) return;
    const take = out.take!;
    const totalBytes = take.reduce((n, i) => n + out.files[i]!.size, 0);
    let totalDone = 0;

    for (const [pos, index] of take.entries()) {
      const f = out.files[index]!;
      const progress = (fileDone: number) =>
        this.deps.emit({
          kind: "progress",
          dir: "out",
          file: pos + 1,
          files: take.length,
          name: f.name,
          fileBytes: f.size,
          fileDone,
          totalBytes,
          totalDone,
        });
      if (!this.post({ t: "file", id: out.id, index })) return;
      progress(0);
      let fileDone = 0;
      let n = 0;
      for (let off = 0; off < f.size; off += READ_SLICE) {
        const buf = await f.slice(off, Math.min(off + READ_SLICE, f.size)).arrayBuffer();
        if (this.out !== out) return;
        for (let o = 0; o < buf.byteLength; o += PAIR_CHUNK_BYTES) {
          // Backpressure: never more than the high-water mark waiting in the
          // channel. `bufferedamountlow` wakes this.
          await this.until(() => this.out !== out || this.deps.channel.bufferedAmount < PAIR_HIGH_WATER);
          if (this.out !== out) return;
          const chunk = buf.slice(o, Math.min(o + PAIR_CHUNK_BYTES, buf.byteLength));
          if (!this.postRaw(chunk)) return;
          fileDone += chunk.byteLength;
          totalDone += chunk.byteLength;
          if (++n % PROGRESS_EVERY === 0) progress(fileDone);
        }
      }
      if (!this.post({ t: "file-end", id: out.id, index })) return;
      progress(fileDone);
    }
    if (!this.post({ t: "done", id: out.id })) return;

    await this.until(() => this.out !== out || out.finished !== null);
    if (this.out !== out) return;
    this.endOut("done", out.finished!);
  }

  private endOut(outcome: Outcome, extra: Partial<Extract<LinkEvent, { kind: "end" }>> = {}) {
    const out = this.out;
    if (!out) return;
    this.out = null;
    this.deps.emit({
      kind: "end",
      dir: "out",
      outcome,
      added: 0,
      failed: [],
      offered: out.files.length,
      noRoom: out.take ? out.files.length - out.take.length : 0,
      ...extra,
    });
    this.poke();
  }

  // ── receiving ──────────────────────────────────────────────────────────────

  /** Yes to the question: ask for the files in `take`. */
  accept(): void {
    const inn = this.inn;
    if (!inn || inn.receiving) return;
    inn.receiving = true;
    if (!this.post({ t: "accept", id: inn.id, take: inn.take })) return;
    this.progressIn(inn, 0, 0);
  }

  /** No to the question. Nothing is sent, nothing is added. */
  decline(): void {
    const inn = this.inn;
    if (!inn || inn.receiving) return;
    this.post({ t: "decline", id: inn.id, reason: "declined" });
    this.endIn("declined");
  }

  /** Stop the transfer in either direction, and tell the other side. */
  cancel(): void {
    const id = this.out?.id ?? this.inn?.id;
    if (!id) return;
    this.post({ t: "cancel", id });
    if (this.out) this.endOut("canceled", { by: "me" });
    if (this.inn) this.endIn("canceled", { by: "me" });
  }

  private onOffer(m: Extract<Wire, { t: "offer" }>) {
    if (this.busy) {
      this.post({ t: "decline", id: m.id, reason: "busy" });
      return;
    }
    const from = peerLabel(m.from, this.deps.peerRole);
    const refuse = (code: DeclineReason, reason: string, offered: number, noRoom = 0) => {
      this.post({ t: "decline", id: m.id, reason: code });
      this.deps.emit({ kind: "end", dir: "in", outcome: "refused", reason, added: 0, failed: [], offered, noRoom });
    };
    const check = checkManifest(m.files);
    if (!check.ok) return refuse("refused", check.reason, Array.isArray(m.files) ? m.files.length : 0);
    const { entries, skipped } = check;
    const left = new Set(skipped.map((s) => s.index));
    const allowed = entries.map((_, i) => i).filter((i) => !left.has(i));
    const room = Math.max(0, Math.floor(this.deps.room()));
    const take = allowed.slice(0, room);
    const noRoom = allowed.length - take.length;
    if (allowed.length === 0) return refuse("refused", "None of them are photos this gallery can take.", entries.length);
    if (take.length === 0) return refuse("full", "Your gallery is full.", entries.length, noRoom);
    const bytes = take.reduce((n, i) => n + entries[i]!.bytes, 0);
    this.inn = {
      id: m.id,
      from,
      entries,
      take,
      noRoom,
      bytes,
      receiving: false,
      pending: new Set(take),
      cur: null,
      done: 0,
      added: 0,
      failed: [],
      queue: Promise.resolve(),
      chunksSeen: 0,
    };
    this.deps.emit({ kind: "incoming", offer: { id: m.id, from, files: entries, take, skipped, noRoom, bytes } });
  }

  private onFile(inn: Incoming, index: number) {
    if (!inn.receiving) return;
    // A file that never ended is as good as a size that didn't match.
    if (inn.cur) this.settle(inn, inn.cur);
    const skip = !inn.pending.has(index);
    inn.cur = { index, skip, chunks: [], got: 0, bad: false };
    if (!skip) this.progressIn(inn, index, 0);
  }

  private onChunk(buf: ArrayBuffer) {
    const inn = this.inn;
    const cur = inn?.cur;
    if (!inn || !cur || cur.skip) return;
    const entry = inn.entries[cur.index]!;
    if (cur.bad || cur.got + buf.byteLength > entry.bytes) {
      // More than the manifest said: never held past the declared size.
      cur.bad = true;
      cur.chunks = [];
      return;
    }
    cur.chunks.push(buf);
    cur.got += buf.byteLength;
    inn.done += buf.byteLength;
    if (++inn.chunksSeen % PROGRESS_EVERY === 0) this.progressIn(inn, cur.index, cur.got);
  }

  private onFileEnd(inn: Incoming, index: number) {
    const cur = inn.cur;
    if (!cur || cur.index !== index) return;
    inn.cur = null;
    if (!cur.skip) this.settle(inn, cur);
  }

  /** Check one whole file and hand it to the import, after the ones before it. */
  private settle(inn: Incoming, piece: Piece) {
    inn.pending.delete(piece.index);
    const entry = inn.entries[piece.index]!;
    this.progressIn(inn, piece.index, piece.got);
    inn.queue = inn.queue.then(async () => {
      if (piece.bad || piece.got !== entry.bytes) {
        inn.failed.push({ name: entry.name, error: WRONG_SIZE });
        return;
      }
      const blob = new Blob(piece.chunks, { type: entry.type });
      piece.chunks = [];
      if ((await sha256Hex(await blob.arrayBuffer())) !== entry.sha256) {
        inn.failed.push({ name: entry.name, error: CHANGED });
        return;
      }
      const result = await this.deps
        .importFile(new File([blob], entry.name, { type: entry.type }))
        .catch((): ImportResult => ({ ok: false, message: "Couldn't add it to the gallery." }));
      if (result.ok) inn.added += 1;
      else inn.failed.push({ name: entry.name, error: result.message });
    });
  }

  private onDone(inn: Incoming) {
    if (!inn.receiving) return;
    if (inn.cur) {
      const cur = inn.cur;
      inn.cur = null;
      if (!cur.skip) this.settle(inn, cur);
    }
    for (const i of inn.pending) inn.failed.push({ name: inn.entries[i]!.name, error: NEVER_ARRIVED });
    inn.pending.clear();
    void inn.queue.then(() => {
      if (this.inn !== inn) return;
      this.post({ t: "finished", id: inn.id, added: inn.added, failed: inn.failed });
      this.endIn("done");
    });
  }

  private progressIn(inn: Incoming, index: number, fileDone: number) {
    const pos = inn.take.indexOf(index);
    const entry = inn.entries[index]!;
    this.deps.emit({
      kind: "progress",
      dir: "in",
      file: pos + 1,
      files: inn.take.length,
      name: entry.name,
      fileBytes: entry.bytes,
      fileDone,
      totalBytes: inn.bytes,
      totalDone: inn.done,
    });
  }

  /** End the receiving side. The file in flight is thrown away now; the
   *  files already whole finish their check and import first, so the count
   *  in the "end" event is what really landed. */
  private endIn(outcome: Outcome, extra: Partial<Extract<LinkEvent, { kind: "end" }>> = {}) {
    const inn = this.inn;
    if (!inn) return;
    this.inn = null;
    inn.cur = null;
    void inn.queue.then(() =>
      this.deps.emit({
        kind: "end",
        dir: "in",
        outcome,
        added: inn.added,
        failed: inn.failed,
        offered: inn.entries.length,
        noRoom: inn.noRoom,
        ...extra,
      }),
    );
  }

  // ── the wire ───────────────────────────────────────────────────────────────

  private receive(data: unknown) {
    if (typeof data === "string") return this.onText(data);
    if (data instanceof ArrayBuffer) return this.onChunk(data);
    if (ArrayBuffer.isView(data)) {
      return this.onChunk(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    }
    // A Blob or anything else: not this protocol.
  }

  private onText(s: string) {
    const m = parseWire(s);
    if (!m) return;
    const out = this.out && this.out.id === m.id ? this.out : null;
    const inn = this.inn && this.inn.id === m.id ? this.inn : null;
    switch (m.t) {
      case "offer":
        this.onOffer(m);
        return;
      case "accept":
        if (out && out.take === null) {
          const take = acceptedIndices(m.take, out.files.length);
          if (take) {
            out.take = take;
            this.poke();
          } else {
            this.post({ t: "cancel", id: out.id });
            this.endOut("refused", { reason: "refused" });
          }
        }
        return;
      case "decline":
        if (out && out.take === null) {
          const reason = typeof m.reason === "string" ? m.reason : "declined";
          this.endOut("declined", { reason: ["declined", "busy", "full", "refused"].includes(reason) ? reason : "declined" });
        }
        return;
      case "finished":
        if (out && out.take !== null) {
          out.finished = finishedReport(m.added, m.failed, out.take.length);
          this.poke();
        }
        return;
      case "file":
        if (inn) this.onFile(inn, m.index);
        return;
      case "file-end":
        if (inn) this.onFileEnd(inn, m.index);
        return;
      case "done":
        if (inn) this.onDone(inn);
        return;
      case "cancel":
        if (out) this.endOut("canceled", { by: "them" });
        if (inn) this.endIn("canceled", { by: "them" });
        return;
    }
  }

  private post(m: Record<string, unknown>): boolean {
    return this.postRaw(JSON.stringify(m));
  }

  private postRaw(data: string | ArrayBuffer): boolean {
    if (this.closed) return false;
    try {
      this.deps.channel.send(data);
      return true;
    } catch {
      this.lost();
      return false;
    }
  }

  /** The channel closed, or this link was disposed. */
  private lost() {
    this.closed = true;
    this.endOut("disconnected");
    this.endIn("disconnected");
  }

  private poke() {
    const w = this.wake;
    this.wake = null;
    w?.();
  }

  private async until(cond: () => boolean): Promise<void> {
    while (!cond()) await new Promise<void>((resolve) => (this.wake = resolve));
  }
}

/** The receiver's `take`, if it is a fair one: distinct indices of the files
 *  offered, in order. */
function acceptedIndices(raw: unknown, count: number): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > count) return null;
  let last = -1;
  for (const i of raw) {
    if (!Number.isInteger(i) || (i as number) <= last || (i as number) >= count) return null;
    last = i as number;
  }
  return raw as number[];
}

function finishedReport(added: unknown, failed: unknown, max: number): { added: number; failed: Failed[] } {
  const n = Number.isInteger(added) ? Math.min(Math.max(0, added as number), max) : 0;
  const list = Array.isArray(failed)
    ? failed
        .slice(0, max)
        .filter((f): f is Failed => !!f && typeof f === "object" && typeof (f as Failed).name === "string" && typeof (f as Failed).error === "string")
        .map((f) => ({ name: f.name.slice(0, 200), error: f.error.slice(0, 300) }))
    : [];
  return { added: n, failed: list };
}
