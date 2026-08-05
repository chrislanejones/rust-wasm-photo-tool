// A ceiling on how often this app is allowed to upload to Convex.
//
// WHY THIS EXISTS. On 2026-08-05 a single brush stroke produced 28 uploads and
// 238s of network. Over the app's life that became 3.1K `generateUploadUrl`
// calls and 3,535 MB of orphaned storage — which exceeded the Convex free plan,
// disabled every deployment on the account, and took down an unrelated
// production website that happened to share the team. Nothing in the app had
// any notion of "too many uploads"; it uploaded whenever it felt dirty, and it
// felt dirty permanently.
//
// The individual causes are fixed (the ownership guard, the overlap guard, the
// content-hash skip, the debounce). This is the backstop for the ones that are
// not fixed yet and the ones nobody has thought of. A runaway upload loop
// should cost a log line, not a website.
//
// ─────────────────────────────────────────────────────────────────────────
// THE BIAS, WHICH IS THE SAME ONE AS EVERYWHERE ELSE TONIGHT
// ─────────────────────────────────────────────────────────────────────────
//
// This limits the UPLOAD and never the local write. IndexedDB is the restore
// path and has no backup, so a throttled local write would lose work the user
// actually did; a throttled upload costs cloud freshness until the next edit
// gets through. Degrade to staleness, never to loss. Any future caller that
// reaches for this to gate an IndexedDB write is using it wrong.
//
// TWO LIMITS, BECAUSE THEY CATCH DIFFERENT FAILURES
//
//   PER-PHOTO INTERVAL catches a tight loop on one photo — the shape actually
//   observed, where one photo re-uploaded at 0s, 7s, 15.4s and 25s. The
//   content-hash skip already stops re-uploading identical bytes, so this only
//   bites when something is genuinely churning edits faster than a human could
//   want them synced.
//
//   ROLLING-WINDOW CEILING catches breadth — a loop that walks the gallery, or
//   many photos each just under the interval. A per-photo limit alone cannot
//   see that, and it is how a slow leak becomes gigabytes.
//
// Both are deliberately generous against real use and tight against runaway. A
// human editing photos does not approach 60 uploads in an hour; the measured
// incident would have hit it in minutes.

/** Minimum gap between two uploads OF THE SAME PHOTO. */
export const MIN_INTERVAL_MS = 10_000;
/** Width of the rolling window for the global ceiling. */
export const WINDOW_MS = 3_600_000;
/** Maximum uploads of ANY photo within one window. */
export const MAX_PER_WINDOW = 60;

export type DenyReason = "interval" | "ceiling";

export interface UploadBudgetStats {
  /** Uploads inside the current rolling window. */
  inWindow: number;
  /** How many more are allowed right now. */
  remaining: number;
  allowed: number;
  deniedInterval: number;
  deniedCeiling: number;
}

let windowStamps: number[] = [];
const lastByPhoto = new Map<string, number>();
const counts = { allowed: 0, deniedInterval: 0, deniedCeiling: 0 };

function prune(now: number): void {
  const cutoff = now - WINDOW_MS;
  // Stamps are appended in order, so the expired ones are always a prefix.
  let i = 0;
  while (i < windowStamps.length && windowStamps[i]! <= cutoff) i++;
  if (i > 0) windowStamps = windowStamps.slice(i);
}

/**
 * May `photoId` be uploaded right now?
 *
 * Pure apart from the tally — it does NOT consume budget. Call `recordUpload`
 * once the upload actually succeeds, so a failed upload does not spend the
 * allowance it never used.
 *
 * `now` is injectable for tests; production callers omit it.
 */
export function mayUpload(
  photoId: string,
  now: number = Date.now(),
): { ok: true } | { ok: false; reason: DenyReason; retryInMs: number } {
  prune(now);

  const last = lastByPhoto.get(photoId);
  if (last !== undefined && now - last < MIN_INTERVAL_MS) {
    counts.deniedInterval++;
    return { ok: false, reason: "interval", retryInMs: MIN_INTERVAL_MS - (now - last) };
  }

  if (windowStamps.length >= MAX_PER_WINDOW) {
    counts.deniedCeiling++;
    // The window frees up when its oldest stamp falls out.
    const oldest = windowStamps[0]!;
    return { ok: false, reason: "ceiling", retryInMs: oldest + WINDOW_MS - now };
  }

  counts.allowed++;
  return { ok: true };
}

/** Record a SUCCESSFUL upload. Spends one unit of the window and starts the
 *  per-photo interval. */
export function recordUpload(photoId: string, now: number = Date.now()): void {
  prune(now);
  lastByPhoto.set(photoId, now);
  windowStamps.push(now);
}

/** Current budget state. Attached to window for the same reason the save guard
 *  is: a limiter nobody can observe is indistinguishable from a broken one. */
export function uploadBudgetStats(now: number = Date.now()): UploadBudgetStats {
  prune(now);
  return {
    inWindow: windowStamps.length,
    remaining: Math.max(0, MAX_PER_WINDOW - windowStamps.length),
    ...counts,
  };
}

/** Attach to window, same pattern as `__ihSaveGuard` / `__ihContentAudit`. */
export function installUploadBudgetProbe(): void {
  (globalThis as unknown as Record<string, unknown>).__ihUploadBudget = () =>
    uploadBudgetStats();
}

/** Test seam. Clears the window, the per-photo history and the tally. */
export function __resetUploadBudget(): void {
  windowStamps = [];
  lastByPhoto.clear();
  counts.allowed = 0;
  counts.deniedInterval = 0;
  counts.deniedCeiling = 0;
}
