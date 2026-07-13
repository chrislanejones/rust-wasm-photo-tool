# ADR-015 — Hash routing + URL params; the palette navigates via the route registry

- **Status:** Draft
- **Date:** 2026-07-13
- **Deciders:** Chris
- **Supersedes:** —

## Context

The app's navigation state — active tool, tool sub-mode, settings pane — lives
in Zustand (`useToolStore.activeTool`, the five sub-mode fields) and, in the
case of the settings pane, in a `useState` inside `SubscriptionButton`. None of
it is in the URL. Consequences today:

- **No view is linkable.** "Open the Security pane and look at the EXIF toggle"
  cannot be sent as a link, written in a doc, or bookmarked.
- **Back and Forward do nothing.** The browser's own navigation model is unused;
  Back leaves the app entirely.
- **A reload always lands on the default tool.** `activeTool` is deliberately not
  persisted (starting mid-edit on a tool you happened to leave open is worse), so
  there is no way to come back to a view at all.
- The **command palette** (v7.19/7.20) already has an action registry —
  `{ id, label, group, keywords, run() }` in `features/commandPalette/commands.ts`
  — whose `run()` bodies call store setters directly. It is the de facto
  navigation surface, and a URL layer would be the second one.

The share-link concept already exists and is unrelated: `?v=<token>` swaps the
whole app into the read-only `ShareViewer` (`App.tsx`). It addresses a *document*,
not a *view*, and it must keep working exactly as it does.

The forcing function is the palette. Adding a URL layer beside it produces two
independent ways to change the same three enum fields, and two writers to one
piece of state is how the address bar starts lying about where the app is.

## Decision

**Navigation state is expressed in the URL fragment, and the palette's action
registry is the one road to it.**

1. **Grammar.** `#/tool/<toolSlug>[/<modeSlug>]` and `#/settings/<tab>` — e.g.
   `#/tool/paint/blur`, `#/tool/shapes/arrows`, `#/settings/security`.
2. **No router dependency.** `features/routing` (~200 lines) maps
   `Route <-> Zustand <-> location`, mounted as `<RouteSync/>` at the composition
   root. There are no *pages* here, only a tool/sub-mode/pane coordinate.
3. **Public slugs.** The fragment says `paint`; the store says `brush`. The
   `ToolType` ids are known tech debt (`brush`=Paint, `crop`=Adjust & Select,
   `arrow`=Layer Settings, `emoji`=Batch) and CLAUDE.md reserves renaming them for
   the registry migration. Routing maps them instead, and accepts the legacy id as
   an inbound alias so both spellings resolve.
4. **The registry navigates.** Every palette entry that moves the user calls
   `navigateTo(route)`, which applies the route to the stores *and* writes the
   hash. The palette no longer calls `setActiveTool` / `setBrushMode` /
   `openSettings` itself. Alt+, a pasted link, and Back are three front doors on
   one road.
5. **Settings becomes observable.** `settingsOpen` / `settingsTab` move into
   `useUIStore`; a pane you cannot read is a pane you cannot link. This retires
   the one-shot `settingsRequest` signal and the last navigation CustomEvent
   (`image-horse:open-settings`).
6. **Query params are an inbound alias, not a second truth.** `?tool=`, `?mode=`,
   `?settings=` exist for contexts that strip fragments (some chat clients and
   unfurlers). On load they are adopted, canonicalised into the hash, and
   **stripped** from the search. **Precedence: `?v=` (share doc) > hash > query
   params.** `?v=` returns `<ShareViewer>` before `<RouteSync/>` mounts at all.

## Alternatives considered

- **`react-router` (HashRouter).** Rejected: it models pages, and there are none.
  It buys a provider, a route tree, and a dependency to express three enum
  fields, and its `useNavigate`/`useLocation` would still need the same
  state-mirroring layer underneath, because the tools read Zustand, not a router
  context.
- **Path-based routes (`/tool/paint/blur`) via History API.** Rejected: needs a
  server rewrite rule on every host (Netlify *and* Vercel today) to serve
  `index.html` for arbitrary paths. The fragment is free and cannot 404. The app
  is a single-document editor; there is no SEO surface to win.
- **Persist `activeTool` in Zustand and skip the URL.** Rejected: it restores a
  view for *you*, on *that machine*, and still gives no link, no bookmark, and no
  Back. It also re-introduces the "reload lands you mid-edit on the last tool"
  problem the current `partialize` deliberately avoids.
- **URL layer beside the palette, each free to set state.** Rejected — this is
  the failure this ADR exists to prevent. See the pre-mortem.
- **Put the photo / document id in the route.** Rejected as invented scope: photo
  ids are local IndexedDB keys, meaningless on another machine, and the app
  already has a real document-sharing concept (`?v=`). A route to a view is a
  route to a view.

## Pre-mortem (mandatory)

**Six months on, the URL and the app disagree.** Two ways that happens:

1. **The mirror oscillates.** The classic implementation carries an
   `isNavigating` boolean so the state→hash writer can ignore the change its own
   hash→state applier just made. Somebody adds an early return, or an async
   store write lands after the flag clears, and the flag goes stale: hash writes
   state, state writes hash, forever — a render loop, or (subtler) a Back button
   that bounces you forward again.

   **Mitigated in the Decision by not having a flag.** Both directions are
   idempotent and compare before they write: `applyRoute()` calls a setter only
   when the value actually differs, and `writeHash()` assigns `location.hash`
   only when the fragment actually differs. A redundant apply notifies nothing,
   so the mirror has nothing to react to and the cycle cannot sustain itself.
   `routeState.test.ts` asserts this directly ("re-applying the current route is
   a no-op") along with the `hash -> route -> hash` fixed point.

2. **A second navigation path sneaks in.** Someone adds a shiny new "jump to
   tool" affordance — a keyboard shortcut, a context-menu item, a link in an
   empty state — and wires it straight to `setActiveTool`, because that is the
   obvious thing to type. It works. The URL silently stops matching the view, and
   the first person to notice is a user whose bookmark opens the wrong tool.

   **Partially mitigated.** The palette registry is the SSOT and
   `commands.test.ts` asserts every navigating entry lands on an expressible
   route. But the *sidebar* and the *digit shortcuts* still call `setActiveTool`
   directly, and rather than rewrite AppShell (which is mid-dismantle and off
   limits), the state→hash mirror subscribes to the stores unconditionally — so
   those paths still update the URL, they just don't push through
   `navigateTo`. **This is the load-bearing weakness:** the mirror makes a second
   path *survivable*, not impossible. The real fix is the registry migration
   finishing the job, at which point tool activation has one implementation.
   Until then, a reviewer seeing `setActiveTool(` outside `routeState.ts` should
   ask why.

**Blast radius if it does go wrong:** cosmetic. A wrong fragment shows the wrong
address, not the wrong pixels. No user data is in the URL, nothing about routing
touches the engine, the flush path, or IndexedDB, and deleting `<RouteSync/>`
from `App.tsx` reverts the entire feature in one line.

## Consequences

**Good**

- Views are linkable, bookmarkable, and reachable with Back/Forward.
- The palette gains "Copy link to this view" and "Go to route…" almost for free —
  both are just the registry pointed at the route grammar.
- One sub-mode table (`features/tools/toolModes.ts`) now serves the palette and
  the router; there were two copies of that knowledge and there would have been
  three.
- The last navigation-path `window` CustomEvent is gone (Stage 3 of the AppShell
  dismantle).

**Bad / accepted**

- The tool slug table is a second naming of every tool, and it must be kept in
  step with the ids until they are renamed for real. The table is one `Record`
  with the tests pinned to it, and it collapses to identity when the rename
  lands.
- Every tool or sub-mode change now pushes a history entry, so Back walks your
  tool history. Correct, and what a URL implies — but it means a user who toggles
  sub-modes rapidly builds a long history stack. If that turns out to annoy,
  demote sub-mode changes to `replaceState`.
- `useUIStore.subscribe` is called on every UI store change (including the
  image-load progress ticker) to recompute the hash. The recomputation is a
  string compare that early-returns; it is not free, but it is nowhere near a
  frame budget. Do not move this into a per-frame path.

**Follow-ups**

- Sidebar clicks and digit shortcuts should route through `navigateTo` when the
  registry migration reaches them (see pre-mortem #2).
- If a linkable *document* concept ever appears beyond `?v=`, it takes a param,
  not a fragment — the fragment is the view.
