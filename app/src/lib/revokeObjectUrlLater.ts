/**
 * How long a download's object URL stays alive after `a.click()`.
 *
 * Every Download in the app used to revoke on the line after the click. The
 * HTML spec resolves the blob URL when the click is handled, and Chromium holds
 * a token for it, so in Chrome that is safe — and the 09-22-2026 miss
 * ("1 in 10 Alt+E runs never download") did not reproduce on 10-27-2026:
 * 0 of 30 runs at 1× CPU and 0 of 30 at 4×. The deferred revoke is therefore
 * DEFENSIVE, not a proven fix. It covers engines the e2e harness never runs
 * (Safari / iPad, Firefox), where the download starts on a later tick.
 *
 * 40 s is FileSaver.js's figure (2.0.5, `setTimeout(revoke, 4E4) // 40s`),
 * the delay most of the web has shipped for years. The only cost is holding
 * the blob that much longer.
 */
export const DOWNLOAD_URL_LIFETIME_MS = 40_000;

/** Revoke an object URL once a download has had time to start. Use this, never
 *  a bare `URL.revokeObjectURL`, on the line after a download's `a.click()`. */
export function revokeObjectUrlLater(url: string, ms: number = DOWNLOAD_URL_LIFETIME_MS): void {
  setTimeout(() => URL.revokeObjectURL(url), ms);
}
