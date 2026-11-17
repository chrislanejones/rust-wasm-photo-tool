import { describe, expect, it } from "vitest";
import type { IncomingOffer, LinkEvent } from "./photoLink";
import { EDITS_NOTE, reduceTransfer, transferLines, type TransferView } from "./transferView";

const MB = 1024 * 1024;
const offer = (over: Partial<IncomingOffer> = {}): IncomingOffer => ({
  id: "a",
  from: "iPhone",
  files: [1, 2, 3, 4].map((i) => ({ name: `p${i}.jpg`, type: "image/jpeg", bytes: 4.5 * MB, sha256: "0".repeat(64) })),
  take: [0, 1, 2, 3],
  skipped: [],
  noRoom: 0,
  bytes: 18 * MB,
  ...over,
});

function run(events: LinkEvent[], start: TransferView | null = null) {
  return events.reduce<TransferView | null>((v, e) => reduceTransfer(v, e), start);
}

const end = (e: Partial<Extract<LinkEvent, { kind: "end" }>>): LinkEvent => ({
  kind: "end",
  dir: "in",
  outcome: "done",
  added: 0,
  failed: [],
  offered: 4,
  noRoom: 0,
  ...e,
});

describe("the receiving side's prompt", () => {
  it("names the device, the count and the size", () => {
    const v = run([{ kind: "incoming", offer: offer() }])!;
    const l = transferLines(v, "computer");
    expect(l.title).toBe("iPhone wants to send 4 photos (18 MB)");
    expect(l.accept).toBe("Accept");
    expect(l.body).toEqual([]);
  });

  it("says how many won't fit, and what the limits left out", () => {
    const v = run([
      {
        kind: "incoming",
        offer: offer({
          take: [0],
          noRoom: 2,
          bytes: 4.5 * MB,
          skipped: [{ index: 3, name: "p4.jpg", reason: "60.0 MB, over the 50 MB limit for one photo" }],
        }),
      },
    ])!;
    const l = transferLines(v, "computer");
    expect(l.accept).toBe("Accept 1");
    expect(l.body).toEqual([
      "Your gallery has room for 1 more, so 2 won't fit.",
      "p4.jpg can't come: 60.0 MB, over the 50 MB limit for one photo.",
    ]);
  });
});

describe("progress", () => {
  it("per file and overall", () => {
    const v = run([
      { kind: "incoming", offer: offer() },
      { kind: "progress", dir: "in", file: 2, files: 4, name: "p2.jpg", fileBytes: 4 * MB, fileDone: MB, totalBytes: 16 * MB, totalDone: 5 * MB },
    ])!;
    expect(v.phase).toBe("moving");
    const l = transferLines(v, "computer");
    expect(l.title).toBe("Receiving from iPhone");
    expect(l.file).toEqual({ label: "Photo 2 of 4: p2.jpg", percent: 25 });
    expect(l.total).toEqual({ label: "5 MB of 16 MB", percent: 31 });
    expect(l.cancel).toBe(true);
  });
});

describe("the end, in words", () => {
  const into = (e: LinkEvent, role: "computer" | "phone" = "computer") =>
    transferLines(run([{ kind: "incoming", offer: offer() }, e])!, role);

  it("received", () => {
    expect(into(end({ added: 4 })).title).toBe("4 photos added to your gallery");
    const partial = into(end({ added: 1, noRoom: 2, failed: [{ name: "p2.jpg", error: "It changed on the way (the check didn't match), so it was dropped." }] }));
    expect(partial.title).toBe("1 photo added to your gallery");
    expect(partial.body).toEqual([
      "2 didn't fit: the gallery is full.",
      "p2.jpg: It changed on the way (the check didn't match), so it was dropped.",
    ]);
  });

  it("declined, canceled, disconnected", () => {
    expect(into(end({ outcome: "declined" })).title).toBe("Declined. Nothing was added.");
    expect(into(end({ outcome: "canceled", by: "them" })).title).toBe("iPhone canceled");
    expect(into(end({ outcome: "disconnected", added: 1 })).title).toBe("Disconnected");
    expect(into(end({ outcome: "disconnected", added: 1 })).body).toEqual([
      "The photo in progress was discarded. 1 photo was added before that.",
    ]);
  });

  it("refused outright", () => {
    const v = run([end({ outcome: "refused", reason: "It offered 51 photos, over the 50 a batch.", offered: 51 })])!;
    expect(transferLines(v, "computer").title).toBe("Photos from your phone were refused");
    expect(transferLines(v, "computer").body).toEqual(["It offered 51 photos, over the 50 a batch."]);
  });
});

describe("the sending side", () => {
  const out = (events: LinkEvent[], role: "computer" | "phone" = "computer") => transferLines(run(events)!, role);

  it("says edits aren't included, on the computer only", () => {
    const l = out([
      { kind: "preparing", files: 2, bytes: 3 * MB },
      { kind: "offered", files: 2, bytes: 3 * MB },
    ]);
    expect(l.title).toBe("Waiting for your phone to accept…");
    expect(l.body).toContain(EDITS_NOTE);
    expect(l.cancel).toBe(true);
    const phone = out([{ kind: "offered", files: 2, bytes: 3 * MB }], "phone");
    expect(phone.title).toBe("Waiting for your computer to accept…");
    expect(phone.body).not.toContain(EDITS_NOTE);
  });

  it("the end, by reason", () => {
    const d = (e: Partial<Extract<LinkEvent, { kind: "end" }>>, role: "computer" | "phone" = "phone") =>
      out([{ kind: "offered", files: 4, bytes: MB }, end({ dir: "out", ...e })], role);
    expect(d({ added: 4 }).title).toBe("4 photos sent");
    expect(d({ added: 1, noRoom: 3 }).title).toBe("1 of 4 sent");
    expect(d({ added: 1, noRoom: 3 }).body).toEqual(["3 didn't fit: your computer's gallery is full."]);
    expect(d({ outcome: "declined", reason: "declined" }).title).toBe("Your computer declined. Nothing was sent.");
    expect(d({ outcome: "declined", reason: "full" }).title).toBe("Your computer's gallery is full. Nothing was sent.");
    expect(d({ outcome: "declined", reason: "busy" }, "computer").title).toBe("Your phone is busy with other photos. Try again in a moment.");
    expect(d({ outcome: "canceled", by: "me" }).title).toBe("Canceled");
  });

  it("lists what was left out when picking", () => {
    const v = reduceTransfer(null, { kind: "preparing", files: 1, bytes: 10 });
    const withRefused = { ...v!, refused: [{ name: "huge.jpg", reason: "60.0 MB, over the 50 MB limit for one photo" }] };
    expect(transferLines(withRefused, "phone").body).toContain("huge.jpg can't go: 60.0 MB, over the 50 MB limit for one photo.");
  });
});
