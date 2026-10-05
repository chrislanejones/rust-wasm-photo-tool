// What a Batch pass says when it ends (Plan C §3). Per-photo failures used to
// go to console.error only, and the toast counted just the successes — so
// "Logo applied to 10 images" on a 12-photo gallery read as complete.
export function batchOutcome(
  done: string,
  succeeded: number,
  total: number,
): { ok: boolean; text: string } {
  const failed = Math.max(0, total - succeeded);
  if (failed === 0) return { ok: true, text: `${done} ${succeeded} image${succeeded === 1 ? "" : "s"}` };
  return {
    ok: false,
    text: `${done} ${succeeded} of ${total} — ${failed} couldn't be processed`,
  };
}
