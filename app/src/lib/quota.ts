// Storage quota: the numbers behind the one quota gauge (UI Night 6 §2).
//
// DECIMAL units — 1 GB = 1,000,000,000 bytes — matching the marketing site and
// the quota decision ("5 GB" on the pricing page means five billion bytes).
//
// This is deliberately NOT `formatBytes` in lib/format.ts. That one divides by
// 1024 and labels the result KB/MB, which is binary maths under decimal names;
// it is used for file sizes elsewhere, and changing it would change every size
// the app prints. Parked, not fixed tonight. The gauge must match the plan's
// numbers, so it formats its own.
//
// BACKEND (Night 6 §0): `bytesUsed` does not exist yet (#235 is a draft), and
// neither does trash. This is tested against fixtures and wired to nothing.

const UNITS = [
  { v: 1e9, u: "GB" },
  { v: 1e6, u: "MB" },
  { v: 1e3, u: "KB" },
] as const;

/** Bytes as a person reads them, in decimal units. One decimal under 10 of a
 *  unit ("2.4 GB"), whole numbers above ("180 MB"), so the figure is never
 *  more precise than the bar it sits next to. */
export function formatStorage(bytes: number): string {
  const b = Math.max(0, bytes);
  for (const { v, u } of UNITS) {
    if (b >= v) {
      const x = b / v;
      const s = x < 10 ? x.toFixed(1).replace(/\.0$/, "") : String(Math.round(x));
      return `${s} ${u}`;
    }
  }
  return `${Math.round(b)} B`;
}

export interface QuotaFigures {
  /** Live photos and edits. Trash is NOT included here. */
  usedBytes: number;
  /** In the trash, still on the server, still counting. */
  trashBytes: number;
  limitBytes: number;
}

export interface QuotaSegments {
  /** Fractions of the bar, 0..1, each clamped so the two never overflow. */
  used: number;
  trash: number;
  /** Everything counted against the limit — live plus trash. */
  totalBytes: number;
  over: boolean;
}

/** How the bar is drawn. Trash is its own segment ON the bar, not a footnote:
 *  "trash counts against quota" only means something if emptying it visibly
 *  frees space. */
export function quotaSegments({ usedBytes, trashBytes, limitBytes }: QuotaFigures): QuotaSegments {
  const used = Math.max(0, usedBytes);
  const trash = Math.max(0, trashBytes);
  const totalBytes = used + trash;
  const limit = Math.max(1, limitBytes);
  const over = totalBytes >= limit;
  const usedFrac = Math.min(1, used / limit);
  // Trash fills whatever the live bytes left; together they never exceed a
  // full bar, which is what "full" should look like when over quota.
  const trashFrac = Math.min(1 - usedFrac, trash / limit);
  return { used: usedFrac, trash: trashFrac, totalBytes, over };
}

/** The two sentences over quota. The second is the promise, and it has to be
 *  on screen: people who hit a limit assume something was thrown away. */
export const OVER_QUOTA_LINES = [
  "New uploads paused.",
  "Nothing has been deleted.",
] as const;
