// Gallery › Select ▾ › Find duplicates (ticket 232). Pure: which photos look
// the same, which one to keep, and which to tick. The fingerprints come from
// the engine (src/dhash.rs: a 64-bit dHash of the stored thumbnail plus its
// average color); the menu and dialog only render what this returns.
//
// NOTHING HERE DELETES. A plan ticks photos, and the ticks are the gallery
// selection (ADR-079), so the photos leave only through the gallery's own
// Delete Selected and its confirmation.

/** One 64-bit hash, split into two 32-bit halves. */
export interface Hash64 {
  hi: number;
  lo: number;
}

/** One photo's fingerprint as the engine returns it: the 64-bit hash of the
 *  photo as stored, the average color as 0xRRGGBB, and (11-23-2026) the hash
 *  of the photo in its other 7 orientations: 3 turns, and all 4 mirrored. */
export interface Fingerprint extends Hash64 {
  rgb: number;
  /** Orientations 1–7 (src/dhash.rs `ORIENTATIONS`). Absent or empty means
   *  only the straight hash is known. */
  turns?: readonly Hash64[];
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
 * A match through a turn or a flip has to be closer: at most this many bits
 * (11-23-2026). Trying 8 orientations gives a different photo 8 chances to
 * land near by luck, and on the fixtures it does: the two pier shots are 11
 * bits apart straight and 8 in their closest orientation. Measured 11-23-2026:
 *   a turned or flipped copy (lake-rot90, lake-mirror)    0–1 bits
 *   different photos, closest orientation                 8–14 bits
 * 5 sits in that gap the way 6 sits in the straight one, with room both sides.
 */
export const LOOKS_SAME_TURNED_BITS = 5;

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
export function hashDistance(a: Hash64, b: Hash64): number {
  return popcount32((a.hi ^ b.hi) >>> 0) + popcount32((a.lo ^ b.lo) >>> 0);
}

/**
 * The distance between two photos in the orientation where they are closest
 * (11-23-2026). A copy turned a quarter or flipped left to right has a
 * different straight hash, but its straight hash is close to one of the
 * original's turns, so this is the smallest of: straight to straight, each of
 * A's turns to B's straight, and each of B's turns to A's straight. Both
 * directions, so the answer does not depend on which photo came first.
 */
export function lookAlikeDistance(a: Fingerprint, b: Fingerprint): number {
  return Math.min(hashDistance(a, b), turnedDistance(a, b));
}

/** The closest of the turned and flipped pairings alone (Infinity when
 *  neither photo carries turns). */
export function turnedDistance(a: Fingerprint, b: Fingerprint): number {
  let d = Infinity;
  for (const t of a.turns ?? []) d = Math.min(d, hashDistance(t, b));
  for (const t of b.turns ?? []) d = Math.min(d, hashDistance(a, t));
  return d;
}

/** The largest per-channel difference of the two average colors. */
export function colorDistance(a: Fingerprint, b: Fingerprint): number {
  let d = 0;
  for (const shift of [16, 8, 0]) d = Math.max(d, Math.abs(((a.rgb >>> shift) & 255) - ((b.rgb >>> shift) & 255)));
  return d;
}

function looksSame(a: Fingerprint, b: Fingerprint): boolean {
  if (colorDistance(a, b) > COLOR_LIMIT) return false;
  return hashDistance(a, b) <= LOOKS_SAME_BITS || turnedDistance(a, b) <= LOOKS_SAME_TURNED_BITS;
}

/**
 * Groups of look-alikes, each formed AROUND A CENTER (11-23-2026). In gallery
 * order, the first photo not yet in a group is a center, and every later
 * photo not yet in a group that looks the same as THAT photo joins it. So
 * every member is within the limits of its group's first photo.
 *
 * It used to join every close pair and let the joins chain: A~B and B~C put
 * A, B and C together even when A and C were far apart, and a run of small
 * steps (a burst panning across a scene) could pull very different photos
 * into one group. Around a center, A and C stay apart: B joins A's group and
 * C is left with whatever it matches on its own.
 *
 * Groups of one are dropped. `ids` order is kept inside a group, and groups
 * come in the order of their center, so the dialog reads in gallery order.
 */
export function groupLookAlikes(items: readonly { id: string; fp: Fingerprint }[]): string[][] {
  const taken = new Array<boolean>(items.length).fill(false);
  const groups: string[][] = [];
  for (let i = 0; i < items.length; i++) {
    if (taken[i]) continue;
    taken[i] = true;
    const center = items[i]!;
    const group = [center.id];
    for (let j = i + 1; j < items.length; j++) {
      if (taken[j] || !looksSame(center.fp, items[j]!.fp)) continue;
      taken[j] = true;
      group.push(items[j]!.id);
    }
    if (group.length > 1) groups.push(group);
  }
  return groups;
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
