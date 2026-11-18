// The photo protocol on the live pairing (ADR-105, "Sending"). Module state,
// like pairController: a PhotoLink is bound to the data channel while the
// pairing is connected, and dropped (as a disconnect) when it is not.
//
// RECEIVING goes through this device's NORMAL import, never a fork of it:
//   - the computer: the gallery's funnel (useImageSession.handleAddPhotos),
//     which TransferHost already registers in useTransferStore for the Inbox;
//   - the phone: MobileShell's own upload (`onAddFiles`), registered here by
//     usePairPhoneImport. No engine, nothing processed beyond what a picked
//     photo gets.
// SENDING from the computer reads the stored ORIGINALS, never the edits.
//
// Nothing here talks to a server. Not one photo byte reaches Convex.
import { useEffect, useRef } from "react";
import { db } from "@/lib/dexie/db";
import { USE_DEXIE_ORIGINALS } from "@/lib/dexie/flags";
import { getOriginal } from "@/lib/dexie/originalsAdapter";
import type { AddPhotosResult } from "@/lib/addPhotosResult";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useTransferStore, type AddPhotosFn } from "@/features/transfer/transferStore";
import { checkPicked, ownLabel, type Refusal } from "./limits";
import { PhotoLink, type ImportResult, type WireChannel } from "./photoLink";
import { usePairStore, type PairRole } from "./pairStore";
import { usePairSendStore } from "./sendStore";

let link: PhotoLink | null = null;
let bound: RTCDataChannel | null = null;
let phoneImport: AddPhotosFn | null = null;

/** How many more photos this gallery takes right now (its tier's limit). */
function room(): number {
  const g = useGalleryStore.getState();
  return g.maxPhotos - g.photos.length;
}

async function importFile(file: File): Promise<ImportResult> {
  const add = phoneImport ?? useTransferStore.getState().addPhotos;
  if (!add) return { ok: false, message: "This page can't add photos right now." };
  const result = await add([file]);
  const o = result?.outcomes[0];
  if (!result || o?.status === "added") return { ok: true };
  return { ok: false, message: o?.status === "failed" ? o.message : "The gallery is full." };
}

function bind(channel: RTCDataChannel | null, role: PairRole | null) {
  if (channel === bound) return;
  const old = link;
  link = null;
  bound = channel;
  old?.dispose();
  if (!channel || !role) return;
  link = new PhotoLink({
    // RTCDataChannel's overloaded send/addEventListener are wider than the
    // protocol's; it uses strings, ArrayBuffers and three events.
    channel: channel as unknown as WireChannel,
    from: ownLabel(role, navigator.userAgent, navigator.maxTouchPoints),
    peerRole: role === "computer" ? "phone" : "computer",
    room,
    importFile,
    emit: (e) => usePairSendStore.getState().apply(e),
  });
}

/** Keep a PhotoLink on the connected channel. PairHost runs this once. */
export function watchPairChannel(): () => void {
  const sync = () => {
    const s = usePairStore.getState();
    bind(s.status === "connected" ? s.channel : null, s.role);
  };
  sync();
  const stop = usePairStore.subscribe(sync);
  return () => {
    stop();
    bind(null, null);
  };
}

/** Send picked files: what passes the limits goes; the rest are listed with
 *  the reason. Returns what was left out. */
export function sendFiles(files: readonly File[]): Refusal[] {
  const { send, refused } = checkPicked(files);
  const l = link;
  if (!l || l.busy || send.length === 0) return refused;
  const sending = l.send(send);
  usePairSendStore.getState().setRefused(refused);
  sending.catch(() => {});
  return refused;
}

/** The stored original of a gallery photo, as a File. Dexie hands back a lazy
 *  Blob, so nothing is read into memory until it is sent. */
async function originalFile(originalKey: string): Promise<File | null> {
  if (USE_DEXIE_ORIGINALS) {
    const rec = await db.originals.get(originalKey);
    if (rec) return new File([rec.blob], rec.name, { type: rec.mimeType });
  }
  const o = await getOriginal(originalKey);
  return o ? new File([o.bytes], o.name, { type: o.mimeType }) : null;
}

/** The computer's Send to phone: the selected photos' ORIGINALS (or the open
 *  photo with nothing selected). */
export async function sendGalleryPhotos(): Promise<Refusal[]> {
  const g = useGalleryStore.getState();
  const ids = g.selectedIds.size > 0 ? [...g.selectedIds] : g.activePhotoId ? [g.activePhotoId] : [];
  const files: File[] = [];
  const missing: Refusal[] = [];
  for (const entry of g.photos.filter((p) => ids.includes(p.id))) {
    const f = await originalFile(entry.originalKey).catch(() => null);
    if (f) files.push(f);
    else missing.push({ name: entry.name, reason: "its original isn't on this device" });
  }
  const refused = files.length ? sendFiles(files) : [];
  return [...missing, ...refused];
}

export function acceptIncoming(): void {
  link?.accept();
}

export function declineIncoming(): void {
  link?.decline();
}

export function cancelTransfer(): void {
  link?.cancel();
}

/** Wait until the gallery holds `n` photos that were not in `before`, or give
 *  up after `ms`. Returns the new ids, oldest first. */
function newPhotos(before: ReadonlySet<string>, n: number, ms: number): Promise<string[]> {
  const fresh = () => useGalleryStore.getState().photos.filter((p) => !before.has(p.id)).map((p) => p.id);
  return new Promise((resolve) => {
    if (fresh().length >= n) return resolve(fresh());
    const timer = setTimeout(() => {
      stop();
      resolve(fresh());
    }, ms);
    const stop = useGalleryStore.subscribe(() => {
      if (fresh().length < n) return;
      clearTimeout(timer);
      stop();
      resolve(fresh());
    });
  });
}

/** The phone: receive through MobileShell's own upload. It reports nothing
 *  back, so this watches the gallery for the photo to land. */
export function usePairPhoneImport(onAddFiles: (files: File[]) => void): void {
  const latest = useRef(onAddFiles);
  latest.current = onAddFiles;
  useEffect(() => {
    const fn: AddPhotosFn = async (files): Promise<AddPhotosResult> => {
      const before = new Set(useGalleryStore.getState().photos.map((p) => p.id));
      latest.current(files);
      const ids = await newPhotos(before, files.length, 30_000);
      return {
        outcomes: files.map((_, i) =>
          ids[i] ? { status: "added", photoId: ids[i]! } : { status: "failed", message: "Couldn't add it to the gallery." },
        ),
      };
    };
    phoneImport = fn;
    return () => {
      if (phoneImport === fn) phoneImport = null;
    };
  }, []);
}
