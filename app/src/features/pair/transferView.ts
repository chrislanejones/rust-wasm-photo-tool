// What a photo transfer looks like on screen (ADR-105, "Sending"): the
// protocol's events folded into one view, and that view in words. Pure, so
// both devices and both directions read the same lines, tested once.
import { batchLine, sizeText, type Refusal } from "./limits";
import type { Dir, IncomingOffer, LinkEvent } from "./photoLink";
import type { PairRole } from "./pairStore";

type Progress = Extract<LinkEvent, { kind: "progress" }>;
type End = Extract<LinkEvent, { kind: "end" }>;

export interface TransferView {
  dir: Dir;
  /** preparing (sender hashing) → asking (the question is out) → moving → ended. */
  phase: "preparing" | "asking" | "moving" | "ended";
  /** Receiving: what was offered. */
  offer: IncomingOffer | null;
  /** Sending: how many, how big. */
  files: number;
  bytes: number;
  progress: Progress | null;
  end: End | null;
  /** Sending: picked, but left out by the limits. */
  refused: Refusal[];
}

/** The computer's note on what "Send to phone" sends. */
export const EDITS_NOTE = "Sends the original photos. Edits aren't included unless you export the photo first.";

export function reduceTransfer(v: TransferView | null, e: LinkEvent): TransferView | null {
  const blank = (dir: Dir): TransferView => ({
    dir,
    phase: "preparing",
    offer: null,
    files: 0,
    bytes: 0,
    progress: null,
    end: null,
    refused: [],
  });
  switch (e.kind) {
    case "incoming":
      return {
        ...blank("in"),
        phase: "asking",
        offer: e.offer,
        files: e.offer.files.length,
        bytes: e.offer.files.reduce((n, f) => n + f.bytes, 0),
      };
    case "preparing":
      return { ...blank("out"), files: e.files, bytes: e.bytes, refused: v?.dir === "out" && v.phase === "preparing" ? v.refused : [] };
    case "offered":
      return { ...(v?.dir === "out" ? v : blank("out")), phase: "asking", files: e.files, bytes: e.bytes };
    case "progress":
      return { ...(v?.dir === e.dir ? v : blank(e.dir)), phase: "moving", progress: e };
    case "end":
      return { ...(v?.dir === e.dir ? v : blank(e.dir)), phase: "ended", end: e };
  }
}

export interface Bar {
  label: string;
  percent: number;
}

export interface TransferLines {
  title: string;
  body: string[];
  /** Receiving, while asked: the Accept button's text. */
  accept?: string;
  /** Show Cancel. */
  cancel: boolean;
  file?: Bar;
  total?: Bar;
  ended: boolean;
}

const pct = (done: number, of: number) => (of > 0 ? Math.min(100, Math.floor((done / of) * 100)) : 0);
const photos = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;

function bars(p: Progress | null): Pick<TransferLines, "file" | "total"> {
  if (!p) return {};
  return {
    file: { label: `Photo ${p.file} of ${p.files}: ${p.name}`, percent: pct(p.fileDone, p.fileBytes) },
    total: { label: `${sizeText(p.totalDone)} of ${sizeText(p.totalBytes)}`, percent: pct(p.totalDone, p.totalBytes) },
  };
}

function failedLines(end: End): string[] {
  const shown = end.failed.slice(0, 5).map((f) => `${f.name}: ${f.error}`);
  if (end.failed.length > 5) shown.push(`${end.failed.length - 5} more weren't added.`);
  return shown;
}

/** The view in words, on the device whose role is `role`. */
export function transferLines(v: TransferView, role: PairRole): TransferLines {
  const peer = role === "computer" ? "phone" : "computer";
  return v.dir === "in" ? incomingLines(v, peer) : outgoingLines(v, role, peer);
}

function incomingLines(v: TransferView, peer: string): TransferLines {
  const from = v.offer?.from ?? `Your ${peer}`;
  if (v.phase === "asking" && v.offer) {
    const o = v.offer;
    const body: string[] = [];
    if (o.noRoom > 0) body.push(`Your gallery has room for ${o.take.length} more, so ${o.noRoom} won't fit.`);
    for (const s of o.skipped.slice(0, 5)) body.push(`${s.name} can't come: ${s.reason}.`);
    if (o.skipped.length > 5) body.push(`${o.skipped.length - 5} more can't come.`);
    return {
      title: `${from} wants to send ${batchLine(v.files, v.bytes)}`,
      body,
      accept: o.take.length < o.files.length ? `Accept ${o.take.length}` : "Accept",
      cancel: false,
      ended: false,
    };
  }
  if (v.phase !== "ended" || !v.end) {
    return { title: `Receiving from ${from}`, body: [], cancel: true, ended: false, ...bars(v.progress) };
  }
  const end = v.end;
  const before = end.added > 0 ? ` ${photos(end.added)} ${end.added === 1 ? "was" : "were"} added before that.` : "";
  switch (end.outcome) {
    case "done": {
      const body: string[] = [];
      if (end.noRoom > 0) body.push(`${end.noRoom} didn't fit: the gallery is full.`);
      body.push(...failedLines(end));
      return {
        title: end.added > 0 ? `${photos(end.added)} added to your gallery` : "Nothing was added",
        body,
        cancel: false,
        ended: true,
      };
    }
    case "declined":
      return { title: "Declined. Nothing was added.", body: [], cancel: false, ended: true };
    case "canceled":
      return {
        title: end.by === "them" ? `${from} canceled` : "Canceled",
        body: [`The photo in progress was discarded.${before}`],
        cancel: false,
        ended: true,
      };
    case "disconnected":
      return { title: "Disconnected", body: [`The photo in progress was discarded.${before}`], cancel: false, ended: true };
    case "refused":
      return {
        title: `Photos from your ${peer} were refused`,
        body: end.reason ? [end.reason] : [],
        cancel: false,
        ended: true,
      };
  }
}

function outgoingLines(v: TransferView, role: PairRole, peer: string): TransferLines {
  const left = v.refused.slice(0, 5).map((r) => `${r.name} can't go: ${r.reason}.`);
  if (v.refused.length > 5) left.push(`${v.refused.length - 5} more can't go.`);
  const note = role === "computer" ? [EDITS_NOTE] : [];
  if (v.phase === "preparing") {
    return { title: `Getting ${photos(v.files)} ready…`, body: [...left, ...note], cancel: true, ended: false };
  }
  if (v.phase === "asking") {
    return { title: `Waiting for your ${peer} to accept…`, body: [...left, ...note], cancel: true, ended: false };
  }
  if (v.phase === "moving" || !v.end) {
    return { title: `Sending to your ${peer}`, body: left, cancel: true, ended: false, ...bars(v.progress) };
  }
  const end = v.end;
  switch (end.outcome) {
    case "done": {
      const body: string[] = [];
      if (end.noRoom > 0) body.push(`${end.noRoom} didn't fit: your ${peer}'s gallery is full.`);
      body.push(...failedLines(end), ...left);
      return {
        title: end.added === end.offered ? `${photos(end.added)} sent` : `${end.added} of ${end.offered} sent`,
        body,
        cancel: false,
        ended: true,
      };
    }
    case "declined": {
      const title =
        end.reason === "full"
          ? `Your ${peer}'s gallery is full. Nothing was sent.`
          : end.reason === "busy"
            ? `Your ${peer} is busy with other photos. Try again in a moment.`
            : end.reason === "refused"
              ? `Your ${peer} refused them. Nothing was sent.`
              : `Your ${peer} declined. Nothing was sent.`;
      return { title, body: left, cancel: false, ended: true };
    }
    case "canceled":
      return { title: end.by === "them" ? `Your ${peer} canceled` : "Canceled", body: left, cancel: false, ended: true };
    case "disconnected":
      return {
        title: "Disconnected",
        body: [`The photo in progress didn't arrive.${end.added > 0 ? ` ${photos(end.added)} did.` : ""}`],
        cancel: false,
        ended: true,
      };
    case "refused":
      return { title: `Your ${peer} refused them. Nothing was sent.`, body: left, cancel: false, ended: true };
  }
}
