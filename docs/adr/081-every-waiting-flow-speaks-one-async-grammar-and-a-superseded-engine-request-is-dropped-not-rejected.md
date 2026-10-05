# ADR-081: Every waiting flow speaks one async grammar, and a superseded engine request is dropped, not rejected

Date: 2026-10-05   Status: draft   Branch: night/plans-ac-1005 (Plan C §3)

## Context

Each flow that waits (AI job, ZIP export, single download, .ora import,
Batch passes, backup) built its own spinner and toast, and they drifted:
some spun forever, some errored with no way to retry. A photo switch
replaces the engine document under requests still in flight, and those
fire-and-forget calls rejected unhandled: 3–6 leaks per run under 6x CPU,
and still 6 after adding explicit catches. On Fast 3G + 4x CPU, boot showed
6.1 s of blank page before React painted.

## Decision

- `hooks/useAsyncTask.ts` + `components/ui/async-status.tsx`: five states
  (ready / loading / processing / saved / error). Every run times out into
  Error, a superseded run resolves "dropped" and never rejects, and an Error
  always carries an action. Rules live in `docs/UI_CONSISTENCY.md` §10.
- `lib/engine/superseded.ts`: `installDroppedRejectionHandler()`, called at
  boot in `main.tsx`, is a window `unhandledrejection` handler that
  `preventDefault()`s only the messages "engine document replaced" and
  "engine released".
- `hooks/useLoadedDocument.ts`: components read engine-mirror state through
  this accessor, null mid-switch. Guardrail `direct-document-reads`,
  baseline 8, may only go down.
- Boot shell: `index.html` ships a static copy of the React splash inside
  `#root` (desktop only). Measured 6.1 s blank → ~1.5 s.
- Adopted so far: ZIP export out of AppShell into
  `app/session/useZipExport.ts`; .ora import inline `AsyncStatus`; AI job
  60 s upload / 3 min job timeouts with Try again; one download error toast;
  Batch failure counts; a backup-failure status chip.

## Consequences

+ One set of words, timeouts and retry actions across every waiting flow.
+ A photo switch no longer leaks unhandled rejections, without touching
  dozens of call sites.
+ Something paints at ~1.5 s instead of 6.1 s on a slow phone-class load.
- A global handler can hide a superseded rejection someone meant to handle.
  Limited to those two exact messages, but still invisible at the call site.
- "#root non-empty" no longer proves React booted. Two e2e checks now wait
  for the upload input instead, and any new check has to know that.
- The static splash is a second copy of the React splash to keep in step.

## Alternatives rejected

- Per-flow ad hoc spinners (status quo): already drifted.
- Rewrite `workerClient` to resolve superseded calls with a sentinel:
  callers would receive `undefined` values they never check for.
- An editor-frame skeleton as the boot shell: React's first screen is the
  splash, so the skeleton would flash a layout that never appears.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the
global handler became the place superseded errors go to disappear. A new
engine error reuses one of the two messages, or someone widens the list,
and a real failure mid-switch is swallowed with no toast and no log.
Early warning sign to watch for: a diff that adds a third message to
`SUPERSEDED` in `lib/engine/superseded.ts`, or a bug report of a
mid-switch action that "did nothing" with a clean console.
