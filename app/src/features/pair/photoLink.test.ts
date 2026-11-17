// The photo protocol on a fake data channel: two ends wired to each other,
// delivering asynchronously like the real one, with a send buffer the test
// can hold back (backpressure), a hook that changes bytes in flight (the hash
// check), and a close (disconnect). Each test says what was NOT done as well
// as what was: what was never imported, never sent, never asked.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PAIR_CHUNK_BYTES,
  PAIR_HIGH_WATER,
  PhotoLink,
  type LinkEvent,
  type WireChannel,
} from "./photoLink";
import { PAIR_FILE_MAX_BYTES, type PeerLabel } from "./limits";

type Data = string | ArrayBuffer;
type Fn = (e: { data?: Data }) => void;

class FakeChannel implements WireChannel {
  readyState: RTCDataChannelState = "open";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  binaryType: BinaryType = "blob";
  peer!: FakeChannel;
  /** Everything this end sent, in order. */
  sent: Data[] = [];
  /** Most bytes ever waiting in this end's buffer. */
  peak = 0;
  /** False: hold what is sent until `drain()`, like a slow network. */
  flowing = true;
  /** Change a message on its way out (null drops nothing; return it as is). */
  tamper: ((d: Data) => Data) | null = null;
  private held: Data[] = [];
  private fns = new Map<string, Set<Fn>>();

  addEventListener(type: string, fn: Fn) {
    const s = this.fns.get(type) ?? new Set<Fn>();
    this.fns.set(type, s);
    s.add(fn);
  }
  removeEventListener(type: string, fn: Fn) {
    this.fns.get(type)?.delete(fn);
  }
  fire(type: string, e: { data?: Data } = {}) {
    for (const fn of [...(this.fns.get(type) ?? [])]) fn(e);
  }
  send(data: Data) {
    if (this.readyState !== "open") throw new Error("InvalidStateError: not open");
    const d = this.tamper ? this.tamper(data) : data;
    this.sent.push(d);
    this.bufferedAmount += size(d);
    this.peak = Math.max(this.peak, this.bufferedAmount);
    this.held.push(d);
    if (this.flowing) this.schedule();
  }
  drain() {
    this.flowing = true;
    this.schedule();
  }
  private scheduled = false;
  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    setTimeout(() => {
      this.scheduled = false;
      while (this.flowing && this.held.length) {
        const d = this.held.shift()!;
        const before = this.bufferedAmount;
        this.bufferedAmount -= size(d);
        if (before > this.bufferedAmountLowThreshold && this.bufferedAmount <= this.bufferedAmountLowThreshold) {
          this.fire("bufferedamountlow");
        }
        if (this.peer.readyState === "open") this.peer.fire("message", { data: typeof d === "string" ? d : d.slice(0) });
      }
    }, 0);
  }
  close() {
    if (this.readyState === "closed") return;
    this.readyState = "closed";
    this.peer.readyState = "closed";
    this.held = [];
    this.fire("close");
    this.peer.fire("close");
  }
  texts() {
    return this.sent.filter((d): d is string => typeof d === "string").map((s) => JSON.parse(s) as Record<string, unknown>);
  }
  binaries() {
    return this.sent.filter((d): d is ArrayBuffer => typeof d !== "string");
  }
}

function size(d: Data) {
  return typeof d === "string" ? d.length : d.byteLength;
}

function wired() {
  const a = new FakeChannel();
  const b = new FakeChannel();
  a.peer = b;
  b.peer = a;
  return [a, b] as const;
}

interface End {
  link: PhotoLink;
  events: LinkEvent[];
  imported: File[];
  ch: FakeChannel;
}

function end(
  ch: FakeChannel,
  opts: {
    from?: PeerLabel;
    peerRole?: "computer" | "phone";
    room?: number;
    importOk?: (f: File) => boolean;
    onEvent?: (e: LinkEvent) => void;
  } = {},
): End {
  const events: LinkEvent[] = [];
  const imported: File[] = [];
  const link = new PhotoLink({
    channel: ch,
    from: opts.from ?? "Computer",
    peerRole: opts.peerRole ?? "phone",
    room: () => opts.room ?? 12,
    importFile: async (f) => {
      if (opts.importOk && !opts.importOk(f)) return { ok: false, message: "The gallery is full." };
      imported.push(f);
      return { ok: true };
    },
    emit: (e) => {
      events.push(e);
      opts.onEvent?.(e);
    },
  });
  return { link, events, imported, ch };
}

/** A phone (sender) and a computer (receiver) on one wire. */
function phoneToComputer(room = 12) {
  const [p, c] = wired();
  const phone = end(p, { from: "iPhone", peerRole: "computer" });
  const computer = end(c, { from: "Computer", peerRole: "phone", room });
  return { phone, computer };
}

let seed = 1;
function bytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    out[i] = seed >>> 24;
  }
  return out;
}

function photo(name: string, n: number, type = "image/png") {
  return new File([bytes(n)], name, { type });
}

const sha = (b: ArrayBuffer | Uint8Array) => createHash("sha256").update(new Uint8Array(b as ArrayBuffer)).digest("hex");

async function until(cond: () => boolean, ms = 3000) {
  const t = Date.now();
  while (!cond()) {
    if (Date.now() - t > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 2));
  }
}

const ended = (e: End) => e.events.find((x) => x.kind === "end") as Extract<LinkEvent, { kind: "end" }> | undefined;
const incoming = (e: End) => e.events.find((x) => x.kind === "incoming") as Extract<LinkEvent, { kind: "incoming" }> | undefined;

describe("the manifest", () => {
  it("comes first: the count, each file's name, type, bytes and SHA-256, and the sender's label", async () => {
    const { phone, computer } = phoneToComputer();
    const a = photo("a.png", 1000);
    const b = photo("b.jpg", 2500, "image/jpeg");
    void phone.link.send([a, b]);
    await until(() => !!incoming(computer));
    const offer = incoming(computer)!.offer;
    expect(offer.from).toBe("iPhone");
    expect(offer.files).toEqual([
      { name: "a.png", type: "image/png", bytes: 1000, sha256: sha(await a.arrayBuffer()) },
      { name: "b.jpg", type: "image/jpeg", bytes: 2500, sha256: sha(await b.arrayBuffer()) },
    ]);
    expect(offer.take).toEqual([0, 1]);
    // Nothing but the manifest went before the answer.
    expect(phone.ch.sent).toHaveLength(1);
    expect(phone.ch.binaries()).toHaveLength(0);
  });
});

describe("accept and decline", () => {
  it("accept: every file arrives byte-identical, through the import, and both sides finish", async () => {
    const { phone, computer } = phoneToComputer();
    const files = [photo("a.png", 40_000), photo("b.png", 17), photo("c.png", PAIR_CHUNK_BYTES)];
    const sending = phone.link.send(files);
    await until(() => !!incoming(computer));
    computer.link.accept();
    await sending;
    await until(() => !!ended(computer));
    expect(computer.imported.map((f) => f.name)).toEqual(["a.png", "b.png", "c.png"]);
    for (let i = 0; i < files.length; i++) {
      expect(sha(await computer.imported[i]!.arrayBuffer())).toBe(sha(await files[i]!.arrayBuffer()));
      expect(computer.imported[i]!.type).toBe("image/png");
    }
    expect(ended(computer)).toMatchObject({ dir: "in", outcome: "done", added: 3, failed: [] });
    expect(ended(phone)).toMatchObject({ dir: "out", outcome: "done", added: 3, failed: [] });
    expect(phone.link.busy).toBe(false);
    expect(computer.link.busy).toBe(false);
  });

  it("decline: no file byte is sent and nothing is imported", async () => {
    const { phone, computer } = phoneToComputer();
    const sending = phone.link.send([photo("a.png", 5000)]);
    await until(() => !!incoming(computer));
    computer.link.decline();
    await sending;
    expect(ended(phone)).toMatchObject({ outcome: "declined", reason: "declined" });
    expect(ended(computer)).toMatchObject({ outcome: "declined" });
    expect(phone.ch.binaries()).toHaveLength(0);
    expect(computer.imported).toEqual([]);
  });

  it("a second offer while busy is declined as busy, and the first goes on", async () => {
    const { phone, computer } = phoneToComputer();
    const first = phone.link.send([photo("a.png", 100)]);
    await until(() => !!incoming(computer));
    // A raw second manifest on the same wire.
    phone.ch.send(JSON.stringify({ t: "offer", v: 1, id: "second", from: "iPhone", files: [{ name: "x.png", type: "image/png", bytes: 1, sha256: "0".repeat(64) }] }));
    await until(() => computer.ch.texts().some((m) => m.t === "decline" && m.id === "second"));
    expect(computer.ch.texts().find((m) => m.id === "second")).toMatchObject({ reason: "busy" });
    computer.link.accept();
    await first;
    await until(() => !!ended(computer));
    expect(computer.imported).toHaveLength(1);
  });
});

describe("chunking and backpressure", () => {
  it("16 KB chunks, one file at a time, in order", async () => {
    const { phone, computer } = phoneToComputer();
    const sending = phone.link.send([photo("a.png", 40_000), photo("b.png", 20_000)]);
    await until(() => !!incoming(computer));
    computer.link.accept();
    await sending;
    const sizes = phone.ch.binaries().map((b) => b.byteLength);
    expect(sizes).toEqual([16384, 16384, 7232, 16384, 3616]);
    expect(Math.max(...sizes)).toBe(PAIR_CHUNK_BYTES);
    // Framing: a file's header, its chunks, its end, then the next file.
    const frame = phone.ch.sent.map((d) => (typeof d === "string" ? (JSON.parse(d) as { t: string; index?: number }) : null));
    const marks = frame.map((m) => (m === null ? "#" : m.index !== undefined ? `${m.t}:${m.index}` : m.t)).join(" ");
    expect(marks).toBe("offer file:0 # # # file-end:0 file:1 # # file-end:1 done");
  });

  it("waits on the send buffer: never more than the high-water mark plus one chunk queued", async () => {
    const { phone, computer } = phoneToComputer();
    const big = photo("big.png", 3 * 1024 * 1024);
    phone.ch.flowing = false;
    const sending = phone.link.send([big]);
    // The manifest is held too: let it through, then hold the file.
    phone.ch.drain();
    await until(() => !!incoming(computer));
    phone.ch.flowing = false;
    computer.link.accept();
    await until(() => phone.ch.bufferedAmount >= PAIR_HIGH_WATER);
    const stalled = phone.ch.binaries().length;
    await new Promise((r) => setTimeout(r, 30));
    // Paused: nothing more was handed to the channel while it was full.
    expect(phone.ch.binaries().length).toBe(stalled);
    expect(phone.ch.bufferedAmountLowThreshold).toBeGreaterThan(0);
    expect(phone.ch.bufferedAmountLowThreshold).toBeLessThan(PAIR_HIGH_WATER);
    phone.ch.drain();
    await sending;
    await until(() => !!ended(computer));
    expect(phone.ch.peak).toBeLessThanOrEqual(PAIR_HIGH_WATER + PAIR_CHUNK_BYTES + 4096);
    expect(sha(await computer.imported[0]!.arrayBuffer())).toBe(sha(await big.arrayBuffer()));
  });
});

describe("the hash check", () => {
  it("a file changed on the way is dropped with an error; the rest go on", async () => {
    const { phone, computer } = phoneToComputer();
    let first = true;
    phone.ch.tamper = (d) => {
      if (typeof d === "string" || !first) return d;
      first = false;
      const copy = new Uint8Array(d.slice(0));
      copy[10] = copy[10]! ^ 0xff;
      return copy.buffer;
    };
    const sending = phone.link.send([photo("bad.png", 20_000), photo("good.png", 20_000)]);
    await until(() => !!incoming(computer));
    computer.link.accept();
    await sending;
    await until(() => !!ended(computer));
    expect(computer.imported.map((f) => f.name)).toEqual(["good.png"]);
    const end_ = ended(computer)!;
    expect(end_).toMatchObject({ outcome: "done", added: 1 });
    expect(end_.failed).toEqual([{ name: "bad.png", error: "It changed on the way (the check didn't match), so it was dropped." }]);
    expect(ended(phone)).toMatchObject({ outcome: "done", added: 1 });
    expect(ended(phone)!.failed.map((f) => f.name)).toEqual(["bad.png"]);
  });
});

describe("cancel and disconnect", () => {
  it("the sender cancels mid-file: the partial file is discarded on both", async () => {
    const { phone, computer } = phoneToComputer();
    const sending = phone.link.send([photo("a.png", 2 * 1024 * 1024)]);
    await until(() => !!incoming(computer));
    // Hold the wire, so the cancel lands mid-file for certain.
    phone.ch.flowing = false;
    computer.link.accept();
    await until(() => phone.ch.binaries().length > 3);
    phone.link.cancel();
    phone.ch.drain();
    await sending;
    await until(() => !!ended(computer));
    expect(ended(phone)).toMatchObject({ outcome: "canceled", by: "me" });
    expect(ended(computer)).toMatchObject({ outcome: "canceled", by: "them" });
    expect(computer.imported).toEqual([]);
    // It stopped: nowhere near the whole file went.
    expect(phone.ch.binaries().length).toBeLessThan(128);
  });

  it("the receiver cancels mid-file: the sender stops, nothing partial is kept", async () => {
    const [p, c] = wired();
    const phone = end(p, { from: "iPhone", peerRole: "computer" });
    // Cancel at the first quarter megabyte in.
    const computer: End = end(c, {
      onEvent: (e) => {
        if (e.kind === "progress" && e.fileDone > 0) queueMicrotask(() => computer.link.cancel());
      },
    });
    const sending = phone.link.send([photo("a.png", 2 * 1024 * 1024)]);
    await until(() => !!incoming(computer));
    computer.link.accept();
    await sending;
    await until(() => !!ended(computer));
    expect(ended(computer)).toMatchObject({ outcome: "canceled", by: "me" });
    expect(ended(phone)).toMatchObject({ outcome: "canceled", by: "them" });
    expect(computer.imported).toEqual([]);
  });

  it("a cancel before the answer ends the prompt on the other side", async () => {
    const { phone, computer } = phoneToComputer();
    const sending = phone.link.send([photo("a.png", 100)]);
    await until(() => !!incoming(computer));
    phone.link.cancel();
    await sending;
    await until(() => !!ended(computer));
    expect(ended(computer)).toMatchObject({ outcome: "canceled", by: "them" });
  });

  it("a disconnect mid-file: both see Disconnected, the partial file is discarded, finished files stay", async () => {
    const [p, c] = wired();
    const phone = end(p, { from: "iPhone", peerRole: "computer" });
    // Pull the plug a quarter megabyte into the second file.
    const computer = end(c, {
      onEvent: (e) => {
        if (e.kind === "progress" && e.file === 2 && e.fileDone > 0) queueMicrotask(() => p.close());
      },
    });
    const sending = phone.link.send([photo("small.png", 1000), photo("big.png", 2 * 1024 * 1024)]);
    await until(() => !!incoming(computer));
    computer.link.accept();
    await sending;
    await until(() => !!ended(computer));
    expect(ended(phone)).toMatchObject({ outcome: "disconnected" });
    expect(ended(computer)).toMatchObject({ outcome: "disconnected", added: 1 });
    expect(computer.imported.map((f) => f.name)).toEqual(["small.png"]);
  });
});

describe("a sender that lies", () => {
  const entry = (i: number, bytes = 10) => ({ name: `p${i}.png`, type: "image/png", bytes, sha256: "a".repeat(64) });

  async function rawOffer(files: unknown[], from: unknown = "iPhone") {
    const [p, c] = wired();
    const computer = end(c, { room: 12 });
    p.send(JSON.stringify({ t: "offer", v: 1, id: "lie", from, files }));
    await until(() => p.peer.sent.length > 0 || computer.events.length > 0);
    return { p, computer };
  }

  it("51 files in the manifest: refused whole, nobody is asked", async () => {
    const { computer } = await rawOffer(Array.from({ length: 51 }, (_, i) => entry(i)));
    await until(() => computer.ch.texts().length > 0);
    expect(computer.ch.texts()[0]).toMatchObject({ t: "decline", id: "lie", reason: "refused" });
    expect(incoming(computer)).toBeUndefined();
    expect(computer.events.find((e) => e.kind === "end")).toMatchObject({
      outcome: "refused",
      reason: "It offered 51 photos, over the 50 a batch.",
    });
    expect(computer.link.busy).toBe(false);
  });

  it("a file over 50 MB in the manifest: that one is left out with the reason, the rest are asked", async () => {
    const { computer } = await rawOffer([entry(0), entry(1, PAIR_FILE_MAX_BYTES + 1), entry(2)]);
    await until(() => !!incoming(computer));
    const offer = incoming(computer)!.offer;
    expect(offer.take).toEqual([0, 2]);
    expect(offer.skipped).toEqual([{ index: 1, name: "p1.png", reason: "50.0 MB, over the 50 MB limit for one photo" }]);
  });

  it("a type that is not a photo is left out", async () => {
    const { computer } = await rawOffer([entry(0), { ...entry(1), name: "x.exe", type: "application/x-msdownload" }]);
    await until(() => !!incoming(computer));
    expect(incoming(computer)!.offer.take).toEqual([0]);
  });

  it("a malformed manifest is refused, and an odd device label becomes Phone", async () => {
    const bad = await rawOffer([{ name: "a.png", type: "image/png", bytes: -1, sha256: "zz" }]);
    await until(() => bad.computer.ch.texts().length > 0);
    expect(bad.computer.ch.texts()[0]).toMatchObject({ t: "decline", reason: "refused" });
    const odd = await rawOffer([entry(0)], "<script>");
    await until(() => !!incoming(odd.computer));
    expect(incoming(odd.computer)!.offer.from).toBe("Phone");
  });

  it("more bytes than the manifest said: the file is dropped, never imported", async () => {
    const [p, c] = wired();
    const computer = end(c);
    const real = bytes(100);
    p.send(JSON.stringify({ t: "offer", v: 1, id: "big", from: "iPhone", files: [{ name: "a.png", type: "image/png", bytes: 50, sha256: sha(real.slice(0, 50)) }] }));
    await until(() => !!incoming(computer));
    computer.link.accept();
    p.send(JSON.stringify({ t: "file", id: "big", index: 0 }));
    p.send(real.buffer.slice(0));
    p.send(JSON.stringify({ t: "file-end", id: "big", index: 0 }));
    p.send(JSON.stringify({ t: "done", id: "big" }));
    await until(() => !!ended(computer));
    expect(computer.imported).toEqual([]);
    expect(ended(computer)!.failed[0]!.error).toMatch(/size/);
  });

  it("a file it was not asked for is ignored", async () => {
    const [p, c] = wired();
    const computer = end(c, { room: 1 });
    const one = bytes(10);
    const files = [0, 1].map((i) => ({ name: `p${i}.png`, type: "image/png", bytes: 10, sha256: sha(one) }));
    p.send(JSON.stringify({ t: "offer", v: 1, id: "x", from: "iPhone", files }));
    await until(() => !!incoming(computer));
    expect(incoming(computer)!.offer.take).toEqual([0]);
    computer.link.accept();
    for (const index of [1, 0]) {
      p.send(JSON.stringify({ t: "file", id: "x", index }));
      p.send(one.buffer.slice(0));
      p.send(JSON.stringify({ t: "file-end", id: "x", index }));
    }
    p.send(JSON.stringify({ t: "done", id: "x" }));
    await until(() => !!ended(computer));
    expect(computer.imported.map((f) => f.name)).toEqual(["p0.png"]);
  });
});

describe("the receiving gallery's limit", () => {
  it("room for 1 of 3: one is asked for, two are counted as not fitting, one is sent", async () => {
    const { phone, computer } = phoneToComputer(1);
    const sending = phone.link.send([photo("a.png", 100), photo("b.png", 100), photo("c.png", 100)]);
    await until(() => !!incoming(computer));
    expect(incoming(computer)!.offer).toMatchObject({ take: [0], noRoom: 2 });
    computer.link.accept();
    await sending;
    await until(() => !!ended(computer));
    expect(computer.imported.map((f) => f.name)).toEqual(["a.png"]);
    expect(phone.ch.texts().filter((m) => m.t === "file")).toHaveLength(1);
    expect(ended(phone)).toMatchObject({ outcome: "done", added: 1, offered: 3, noRoom: 2 });
  });

  it("a full gallery declines on its own and says so", async () => {
    const { phone, computer } = phoneToComputer(0);
    await phone.link.send([photo("a.png", 100)]);
    expect(ended(phone)).toMatchObject({ outcome: "declined", reason: "full" });
    expect(incoming(computer)).toBeUndefined();
    expect(ended(computer)).toMatchObject({ outcome: "refused", reason: "Your gallery is full." });
  });
});
