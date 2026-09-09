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

import { auditRotatedText, formatRotatedTextMarkdown } from "./rotatedTextAudit";
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

/** `await window.__ihRotatedTextAudit()` → { report, markdown }.
 *
 *  The one number ADR-050's migration decision needs: how many STORED text
 *  annotations are rotated. Read-only by construction; it will not even open
 *  the archive database unless `indexedDB.databases()` says it already
 *  exists. */
async function runRotatedTextAudit() {
  const report = await auditRotatedText();
  return { report, markdown: formatRotatedTextMarkdown(report) };
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

/** `await window.__ihRotatedTextAudit()` → { report, markdown }.
 *
 *  UNGATED, like the archive-corruption audit beside it and for the same
 *  reason. It was first written into `installContentAudit`, which only runs
 *  under `import.meta.env.DEV || webgpuEnabled()` — so it would have been
 *  present everywhere EXCEPT the production profile whose annotations are the
 *  entire point of counting. A probe hidden from the data it exists to measure
 *  reports zero and looks like an answer.
 *
 *  Costs a function definition that reads integers off a read-only cursor. */
export function installRotatedTextAudit(): void {
  (globalThis as unknown as Record<string, unknown>).__ihRotatedTextAudit =
    runRotatedTextAudit;
}
