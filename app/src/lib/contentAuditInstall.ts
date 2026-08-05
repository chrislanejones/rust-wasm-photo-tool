// The IndexedDB reachability audit had no entry point — auditContentStores()
// was only ever run by pasting it into a console, which meant re-running it
// after a code change required a rebuild-and-paste dance. This attaches it to
// `window` (same pattern as the GPU blur self-test) so it can be driven from
// the console or automation:
//
//   await window.__ihContentAudit()   → { report, markdown }
//
// It is read-only over IndexedDB by construction — see contentAudit.ts, which
// enforces that rather than promising it. NIGHT JOB VI Phase 3 uses this to
// measure whether an orphan sweeper is worth building at all.

import {
  auditContentStores,
  formatAuditMarkdown,
  type ContentAuditReport,
} from "./contentAudit";

export interface ContentAuditResult {
  report: ContentAuditReport;
  markdown: string;
}

async function runContentAudit(): Promise<ContentAuditResult> {
  const report = await auditContentStores();
  return { report, markdown: formatAuditMarkdown(report) };
}

/** Attach to window so it can be driven from the console or automation. */
export function installContentAudit(): void {
  (globalThis as unknown as Record<string, unknown>).__ihContentAudit = runContentAudit;
}
