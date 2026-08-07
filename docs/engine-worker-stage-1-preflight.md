# Stage 1 pre-flight — do the call sites factor into one port?

**Answer: yes, but the invariant as written in ADR-024 is wrong in one word,
and getting it wrong would cause a regression rather than prevent one.**
Measured 2026-08-07 against `3f6fc6f`.

ADR-024 Stage 1 carries a stop condition: *"If the call sites don't factor
cleanly into one port without behaviour change, stop and report the shape."*
This is that report, done before the session rather than during it.

## Three ways code reaches the engine

| # | Route | Scale | Factors into one port? |
|---|---|---|---|
| 1 | **`toolRef.current`** — the live handle via a React ref | **152 accesses**, ~15 files | **Yes**, mechanically |
| 2 | **Passed as a parameter** — `(tool: ImageHorseTool)` | **4 lib/ modules** | Yes — pass the port instead of the handle |
| 3 | **Constructs its own instance** | **2 sites** outside `useEngineCore` | **No — and must not** |

### 1. The live handle

Two access shapes, both the same ref: `toolRef.current` (109) and
`stamp.toolRef.current` (43). Every one is in the React layer — hooks and
components. Top holders: `AppShell` 20, `useTransforms` 18, `useEngineCore` 16,
`useLayers` 14, `useSelectionActions` 11.

This is the clean case. One ref, one owner (`useEngineCore` is the only module
that assigns it), and a mechanical substitution to route through a port.

### 2. The parameter-passed modules

`lib/editPersistence.ts`, `lib/restoreLayerStack.ts`, `lib/openraster/import.ts`,
`lib/openraster/export.ts`.

These are plain modules with no hook context — the same population the
scalar-mirror finding identified as unable to reach React state (14 of 38 scalar
sites). They do not care *what* they are handed as long as it has the methods,
so handing them the port instead of the raw handle is a type change, not a
redesign.

### 3. The throwaway instances — the part ADR-024 does not account for

| Site | What it builds |
|---|---|
| `lib/exportImage.ts:83` | a whole engine per photo, to composite a saved edit during a batch export |
| `features/tools/settings/BatchSettings.tsx:1047` | a whole engine for a batch operation |

**These are different documents.** They are not the photo on screen; they are a
photo the user is not looking at, being rendered on the side. Their operations
must never enter the live document's op log, and they have no undo.

Routing them through the live port would be wrong twice over:

- **Semantically** — their ops would land in the live document's log, and undo
  would start replaying edits to a photo the user never opened.
- **In performance** — a 40-photo batch export would serialise behind the live
  document's queue, which is the thing this whole arc exists to stop.

## The correction

ADR-024's invariant reads:

> **ONE PORT.** Every mutation reaches the engine through a single message
> queue.

It should read **one port per document**, and the guarantee is about the *live*
document:

> **ONE PORT TO THE LIVE DOCUMENT.** Every mutation of the document the user is
> editing reaches the engine through a single message queue. Throwaway engine
> instances built for a document the user is *not* editing — batch export,
> compositing a saved edit — are separate documents with their own lifetimes and
> no op log, and are explicitly out of scope. They must not be routed through
> the live port.

The ordering guarantee is unaffected: `OpLog::append` still records arrival
order, and the live document still has exactly one FIFO queue. The correction
only names what the queue is *for*.

**Why this matters more than a wording nit.** Stage 1's deliverable is a
structural test that fails when something bypasses the port. Written against the
invariant as it currently stands, that test flags both throwaway sites as
violations. The obvious fix — route them through the port — is the regression
described above, and it would be made by someone reading a test that told them
to.

## What Stage 1's structural test must therefore do

| Rule | |
|---|---|
| Flag | `toolRef.current` reached outside the port module |
| Flag | a new `ImageHorseTool` constructed outside `useEngineCore` **or the allowlist** |
| Allow, by name | `lib/exportImage.ts`, `features/tools/settings/BatchSettings.tsx` |
| Require | the allowlist carries a reason per entry, so growing it is a decision |

An allowlist that can be appended to silently is not a guard. Stage 0's version
had no exceptions at all; this one needs two, and the two are the interesting
part of the file rather than a footnote.

## Verdict on the stop condition

**Do not stop.** The call sites factor. The work is a mechanical substitution
across ~15 files plus a typed port, with two documented exclusions — no
behaviour change, no async, no worker, revertible with `git revert`.

The one judgement call to make in-session: whether the port is a module-level
singleton or threaded through the existing `stamp` object. The second keeps the
existing 62-key facade intact and touches fewer call sites; the first is easier
to test structurally. **Not decided here.**
