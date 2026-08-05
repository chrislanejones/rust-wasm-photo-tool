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
  auditArchiveCorruption,
  formatArchiveCorruptionMarkdown,
  type ContentAuditReport,
  type ArchiveCorruptionReport,
} from "./contentAudit";

export interface ContentAuditResult {
  report: ContentAuditReport;
  markdown: string;
}

export interface ArchiveCorruptionResult {
  report: ArchiveCorruptionReport;
  markdown: string;
}

async function runContentAudit(): Promise<ContentAuditResult> {
  const report = await auditContentStores();
  return { report, markdown: formatAuditMarkdown(report) };
}

async function runArchiveCorruptionAudit(): Promise<ArchiveCorruptionResult> {
  const report = await auditArchiveCorruption();
  return { report, markdown: formatArchiveCorruptionMarkdown(report) };
}

/** Attach to window so it can be driven from the console or automation. */
export function installContentAudit(): void {
  (globalThis as unknown as Record<string, unknown>).__ihContentAudit = runContentAudit;
}

/** `await window.__ihArchiveCorruptionAudit()` → { report, markdown }.
 *
 *  Installed SEPARATELY from its sibling, and ungated, because the whole point
 *  is checking a real production profile for archives written by the unguarded
 *  builds. Gating it behind DEV would put it everywhere except the one place
 *  the damage actually is. Read-only by construction: it detects archives
 *  holding another photo's canvas and never repairs one — see the header in
 *  contentAudit.ts for why repair is off the table. */
export function installArchiveCorruptionAudit(): void {
  (globalThis as unknown as Record<string, unknown>).__ihArchiveCorruptionAudit =
    runArchiveCorruptionAudit;
}
