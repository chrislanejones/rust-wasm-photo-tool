// Gallery › Select ▾ › Find duplicates (ticket 232). Pure: which photos look
// the same, which one to keep, and which to tick. The fingerprints come from
// the engine (src/dhash.rs: a 64-bit dHash of the stored thumbnail plus its
// average color); the menu and dialog only render what this returns.
//
// NOTHING HERE DELETES. A plan ticks photos, and the ticks are the gallery
// selection (ADR-079), so the photos leave only through the gallery's own
// Delete Selected and its confirmation.

/** One photo's fingerprint as the engine returns it: the 64-bit hash split
 *  into two 32-bit halves, and the average color as 0xRRGGBB. */
export interface Fingerprint {
  hi: number;
  lo: number;
  rgb: number;
}

/**
 * "Looks the same": at most this many of the 64 hash bits differ.
 *
 * Tuned on e2e/fixtures/dupes (thumbnails made by the gallery's own recipe)
 * and pinned by duplicates.fixtures.test.ts, which prints the full table.
 * Measured 11-15-2026:
 *   same photo (3 sizes, a q 0.55 re-save, a 1-px crop)  0–2 bits
 *   burst pair (walker moved, exposure +2, new noise)    1 bit
 *   two shots of the same pier (step right, zoom 1.4x)   11 bits
 *   different scenes                                     10–21 bits
 * 6 is the ticket's number and sits in the middle of the gap: 4 bits above
 * the worst same-photo pair and 4 under the closest different-photo pair.
 */
export const LOOKS_SAME_BITS = 6;

/**
 * And the average colors are within this much on every channel (0–255). The
 * hash cannot tell a black frame from a white one (no edges: every bit is 0)
 * and ignores color altogether; this is what catches those. Same-photo pairs
 * on the fixtures differ by at most 2; a re-save or a burst's exposure drift
 * is a few levels (the two pier shots differ by 9, the fixture scenes by
 * 52–81); a different flat frame is tens to hundreds.
 */
export const COLOR_LIMIT = 24;

function popcount32(n: number): number {
  n -= (n >>> 1) & 0x55555555;
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** How many of the 64 bits differ. */
export function hashDistance(a: Fingerprint, b: Fingerprint): number {
  return popcount32((a.hi ^ b.hi) >>> 0) + popcount32((a.lo ^ b.lo) >>> 0);
}

/** The largest per-channel difference of the two average colors. */
export function colorDistance(a: Fingerprint, b: Fingerprint): number {
  let d = 0;
  for (const shift of [16, 8, 0]) d = Math.max(d, Math.abs(((a.rgb >>> shift) & 255) - ((b.rgb >>> shift) & 255)));
  return d;
}

function looksSame(a: Fingerprint, b: Fingerprint): boolean {
  return hashDistance(a, b) <= LOOKS_SAME_BITS && colorDistance(a, b) <= COLOR_LIMIT;
}

/**
 * Groups of look-alikes: every pair within the limits is joined, and joins
 * chain (A~B and B~C put A, B and C together even when A and C are further
 * apart). Groups of one are dropped. `ids` order is kept inside a group, and
 * groups come in the order of their first photo, so the dialog reads in
 * gallery order.
 */
export function groupLookAlikes(items: readonly { id: string; fp: Fingerprint }[]): string[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (!looksSame(items[i]!.fp, items[j]!.fp)) continue;
      const a = find(i);
      const b = find(j);
      // The smaller index stays root, so a group is named by its first photo.
      if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
    }
  }
  const byRoot = new Map<number, string[]>();
  items.forEach((it, i) => {
    const r = find(i);
    const g = byRoot.get(r);
    if (g) g.push(it.id);
    else byRoot.set(r, [it.id]);
  });
  return [...byRoot.values()].filter((g) => g.length > 1);
}

/** What the plan needs to know about a photo. */
export interface DuplicateCandidate {
  id: string;
  width: number;
  height: number;
  byteSize: number;
  edited: boolean;
}

export interface GroupPlan {
  /** The group, in gallery order. */
  ids: string[];
  /** The one marked Keep. */
  keep: string;
  /** Pre-ticked: added to the gallery selection when the user says so. */
  ticked: string[];
}

/**
 * Keep and the pre-ticks for one group.
 *
 *   Keep    the edited photo when exactly one is edited; otherwise the
 *           largest resolution (then the larger file, then the first).
 *   Ticked  every photo but Keep, EXCEPT that an edited photo is never
 *           pre-ticked, and when two or more are edited nothing in the group
 *           is: which edit matters is the user's call, not a guess.
 */
export function planGroup(photos: readonly DuplicateCandidate[]): GroupPlan {
  const edited = photos.filter((p) => p.edited);
  let keep = photos[0]!;
  if (edited.length === 1) keep = edited[0]!;
  else {
    for (const p of photos) {
      const area = p.width * p.height;
      const best = keep.width * keep.height;
      if (area > best || (area === best && p.byteSize > keep.byteSize)) keep = p;
    }
  }
  const ticked = edited.length >= 2 ? [] : photos.filter((p) => p !== keep && !p.edited).map((p) => p.id);
  return { ids: photos.map((p) => p.id), keep: keep.id, ticked };
}

/** Group, then plan each group. Photos without a fingerprint (a thumbnail
 *  that would not decode) are left out rather than guessed at. */
export function planDuplicates(
  photos: readonly DuplicateCandidate[],
  fingerprints: ReadonlyMap<string, Fingerprint>,
): GroupPlan[] {
  const items = photos.flatMap((p) => {
    const fp = fingerprints.get(p.id);
    return fp ? [{ id: p.id, fp }] : [];
  });
  const byId = new Map(photos.map((p) => [p.id, p]));
  return groupLookAlikes(items).map((ids) => planGroup(ids.map((id) => byId.get(id)!)));
}
