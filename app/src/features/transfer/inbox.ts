// "Add to gallery" for the Transfer inbox (ADR-102), as one plain function so
// the order that keeps a photo from being lost is written once and tested:
//
//   1. download the file as it was sent;
//   2. run it through the gallery's REAL import (handleAddPhotos), all
//      selected photos in one call, so the tier limit is decided once;
//   3. wait until the gallery manifest in IndexedDB lists the new entries;
//   4. only then `receive`, which deletes the server copy.
//
// Anything that fails at any step stays in the inbox with its reason. A
// photo the limit left out stays too, and is counted.
import type { AddPhotosResult } from "@/lib/addPhotosResult";

export interface InboxEntry {
  id: string;
  name: string;
  mime: string;
  url: string | null;
}

export interface AddDeps {
  /** The file as sent. Throws when it cannot be fetched. */
  download: (item: InboxEntry) => Promise<File>;
  addPhotos: (files: File[]) => Promise<AddPhotosResult | void>;
  /** True once every id is in the stored gallery manifest. */
  confirmSaved: (photoIds: string[]) => Promise<boolean>;
  receive: (id: string) => Promise<unknown>;
}

export interface AddReport {
  added: string[];
  /** Inbox id → why it stayed. */
  errors: Record<string, string>;
  /** Left in the inbox because the gallery was full. */
  overLimit: string[];
}

export const NOT_CONFIRMED =
  "Added to the gallery, but the save could not be confirmed, so it stays here too. Delete it once you see it in the gallery.";

export async function addToGallery(items: readonly InboxEntry[], deps: AddDeps): Promise<AddReport> {
  const report: AddReport = { added: [], errors: {}, overLimit: [] };
  const ready: { item: InboxEntry; file: File }[] = [];
  for (const item of items) {
    if (!item.url) {
      report.errors[item.id] = "This photo is no longer on the server.";
      continue;
    }
    try {
      ready.push({ item, file: await deps.download(item) });
    } catch {
      report.errors[item.id] = "Couldn't download it. Try again.";
    }
  }
  if (ready.length === 0) return report;

  const result = await deps.addPhotos(ready.map((r) => r.file));
  if (!result) {
    for (const { item } of ready) report.errors[item.id] = NOT_CONFIRMED;
    return report;
  }

  const landed: { item: InboxEntry; photoId: string }[] = [];
  ready.forEach(({ item }, i) => {
    const outcome = result.outcomes[i];
    if (outcome?.status === "added") landed.push({ item, photoId: outcome.photoId });
    else if (outcome?.status === "failed") report.errors[item.id] = outcome.message;
    else report.overLimit.push(item.id);
  });
  if (landed.length === 0) return report;

  if (!(await deps.confirmSaved(landed.map((l) => l.photoId)))) {
    for (const { item } of landed) report.errors[item.id] = NOT_CONFIRMED;
    return report;
  }
  for (const { item } of landed) {
    try {
      await deps.receive(item.id);
      report.added.push(item.id);
    } catch {
      report.errors[item.id] = "Added to the gallery, but it couldn't be cleared from the inbox. Delete it here.";
    }
  }
  return report;
}

/** Download a transfer as a File the import accepts. */
export async function downloadEntry(item: InboxEntry, fetchFn: typeof fetch = fetch): Promise<File> {
  const resp = await fetchFn(item.url!);
  if (!resp.ok) throw new Error(`download ${resp.status}`);
  const blob = await resp.blob();
  return new File([blob], item.name, { type: item.mime || blob.type });
}

/** Poll the stored gallery manifest until it lists every id, or give up. */
export async function waitForManifest(
  photoIds: readonly string[],
  load: () => Promise<{ photos: { id: string }[] } | null>,
  { timeoutMs = 5_000, everyMs = 100 }: { timeoutMs?: number; everyMs?: number } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const m = await load().catch(() => null);
    const ids = new Set(m?.photos.map((p) => p.id) ?? []);
    if (photoIds.every((id) => ids.has(id))) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

/** "Expires in 6 days" / "Expires today" / "Expired, removed soon". */
export function expiresIn(expiresAt: number, now: number): string {
  const ms = expiresAt - now;
  if (ms <= 0) return "Expired, removed soon";
  if (ms < 86_400_000) return "Expires today";
  // Rounded up: a photo sent a minute ago reads "7 days", as the phone said.
  const days = Math.ceil(ms / 86_400_000);
  return `Expires in ${days} days`;
}
