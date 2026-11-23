# Image Horse: the docs

Read them in order, like chapters, or jump to the one you need. Every chapter
links to the one before and after it, and back here.

## Contents

| # | Chapter | What it answers |
| --- | --- | --- |
| 1 | [Getting Started](01-Getting-Started.md) | clone to a running editor |
| 2 | [Architecture](02-Architecture.md) | how the pieces fit |
| 3 | [File Map](03-File-Map.md) | where a given thing lives |
| 4 | [Features](04-Features.md) | what the editor does |
| 5 | [Keyboard Shortcuts](05-Keyboard-Shortcuts.md) | every chord |
| 6 | [UI](06.0-UI.md) | start here for UI: the rules, the inventory, the exceptions, and the UI work that shipped |
| 6.1 | [UI Consistency](06.1-UI-Consistency.md) | the ten UI rules, and the scales |
| 6.2 | [UI Inventory](06.2-UI-Inventory.md) | what the UI is actually built from, counted |
| 6.3 | [UI Exceptions](06.3-UI-Exceptions.md) | every place that breaks a rule on purpose, and why |
| 7 | [OpenRaster (.ora)](07-OpenRaster.md) | the .ora format contract |
| 8 | [Plugins](08-Plugins.md) | adding a plugin from Settings → Plugins, and writing one |
| 9 | [MCP](09-MCP.md) | connecting an AI app to your account: the tools, the limits, and what turns it on |
| 10 | [AI Reference Storage](10-AI-Reference-Storage.md) | how a Create AI Image job owns its reference uploads, and when they are deleted |
| 11 | [CI](11-CI.md) | the gates, and which ones block |
| 12 | [Deploying](12-Deploying.md) | how a release reaches production |
| 13 | [Vercel Builds](13-Vercel-Builds.md) | which pushes each Vercel project skips building, and why |
| 14 | [The AppShell Refactor](14-AppShell-Refactor.md) | how the big files get smaller, and what the 2026-09-26 audit found |

## Back matter

The records. These keep their names, because tools and outside links depend
on them.

| | What it is |
| --- | --- |
| [Change Summary](Change-summary.md) | every release, dated, oldest first |
| [Parking Lot](PARKING_LOT.md) | problems noticed but deliberately not fixed yet |
| [Decisions](adr/INDEX.md) | the ADRs: why, not what |
| [QC runs](qc/) | `imagehorse-qc` write-ups, one per run, with their screenshots |
| [Day logs](day-logs/) | what a day or a night of work did, with its screenshots (older ones in [archive/day-logs](archive/day-logs/)) |
| [Benchmarks](benchmarks/) | measured numbers behind engine decisions |
| [The engine worker](engine-worker-feasibility.md) | three notes on moving the engine off the main thread: the [feasibility study](engine-worker-feasibility.md), the [a12 design](engine-worker-a12-design.md) and the [a11-0 finding](engine-worker-a11-0-finding.md) |
| [Archive](archive/README.md) | superseded documents and finished handoffs, kept for their reasoning |

## Why some names stay put

- `Change-summary.md` and `PARKING_LOT.md` are named by the release hook, the
  skills and the repo's CLAUDE.md.
- The three `engine-worker-*` notes are linked by URL from a published blog
  post.
- `adr/`, `qc/` and `day-logs/` are where the decision, QC and day-log
  procedures write.

The chapters were renamed into numbered order on 11-23-2026. Older references
in the Change Summary, the ADRs and the archive still use the old names
(`Architecture.md`, `UI_CONSISTENCY.md`, …). Those are left alone on purpose:
they are historical records, and editing a record to hide that a file moved is
worse than a name you have to map. The map:

| Old name | Now |
| --- | --- |
| `Getting-Started.md` | [01-Getting-Started.md](01-Getting-Started.md) |
| `Architecture.md` | [02-Architecture.md](02-Architecture.md) |
| `File-Map.md` | [03-File-Map.md](03-File-Map.md) |
| `Features.md` | [04-Features.md](04-Features.md) |
| `Keyboard-Shortcuts.md` | [05-Keyboard-Shortcuts.md](05-Keyboard-Shortcuts.md) |
| `UI.md` | [06.0-UI.md](06.0-UI.md) |
| `UI_CONSISTENCY.md` | [06.1-UI-Consistency.md](06.1-UI-Consistency.md) |
| `UI_INVENTORY.md` | [06.2-UI-Inventory.md](06.2-UI-Inventory.md) |
| `UI_EXCEPTIONS.md` | [06.3-UI-Exceptions.md](06.3-UI-Exceptions.md) |
| `OpenRaster-Export-Import.md` | [07-OpenRaster.md](07-OpenRaster.md) |
| `Plugins.md` | [08-Plugins.md](08-Plugins.md) |
| `MCP.md` | [09-MCP.md](09-MCP.md) |
| `AI-reference-storage.md` | [10-AI-Reference-Storage.md](10-AI-Reference-Storage.md) |
| `CI.md` | [11-CI.md](11-CI.md) |
| `Deploying.md` | [12-Deploying.md](12-Deploying.md) |
| `Vercel-builds.md` | [13-Vercel-Builds.md](13-Vercel-Builds.md) |
| `AppShell-Refactor-Plan.md` | [14-AppShell-Refactor.md](14-AppShell-Refactor.md) |

On 2026-09-17, eighteen finished working documents (audits, spikes, one-off
findings, superseded plans) were moved out of the repository. Git history still
has every one of them.
