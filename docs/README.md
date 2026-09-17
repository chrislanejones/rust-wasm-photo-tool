# docs

What is in this folder, and what deliberately is not.

## The set

| File | What it answers |
| --- | --- |
| [Getting-Started.md](Getting-Started.md) | clone to running editor |
| [Architecture.md](Architecture.md) | how the pieces fit |
| [File-Map.md](File-Map.md) | where a given thing lives |
| [Features.md](Features.md) | what the editor does |
| [Keyboard-Shortcuts.md](Keyboard-Shortcuts.md) | every chord |
| [OpenRaster-Export-Import.md](OpenRaster-Export-Import.md) | the .ora format contract |
| [CI.md](CI.md) | the gates, and which ones block |
| [Deploying.md](Deploying.md) | how a release reaches production |
| [Change-summary.md](Change-summary.md) | full release history |
| [PARKING_LOT.md](PARKING_LOT.md) | problems noticed but deliberately not fixed yet |
| [adr/](adr/INDEX.md) | decision records — why, not what |
| [archive/](archive/README.md) | superseded documents, kept for their reasoning |

Three `engine-worker-*` files also live here — the feasibility note, the a12
design and the a11-0 transferred-canvas finding. They are not in the table
because they are not entry points: the published blog post links to them by
URL, so they have to keep their paths.

## What was moved out, 2026-09-17

This folder held 32 markdown files. Eighteen of them were finished working
documents — audits, spikes, one-off findings, superseded plans — that nobody
navigates to and that made the twelve above hard to find.

They were moved out of the repository rather than deleted, and the git history
still has every one of them. **They are not on GitHub any more.**

Some references in `Change-summary.md` and the ADRs still name them. Those were
left alone on purpose: those two are historical records, and editing a record
to hide that a document moved is worse than a reference you have to chase.
