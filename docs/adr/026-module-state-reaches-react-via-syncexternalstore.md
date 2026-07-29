# ADR-026: Non-React module state reaches React via useSyncExternalStore
Date: 2026-07-30   Status: draft   Records: v7.58 (shipped)

Written after the fact. Records the pattern introduced by the update prompt,
because the next person with the same problem will copy whatever is there.

## Context

The service-worker update flow lives in `lib/pwa/` — plain modules that run
outside React, before and independently of the component tree. Two triggers
(a waiting service worker; a `version.json` build-hash disagreement) needed to
put a decision in front of the user.

Previously they called `showUpdateToast()`, which reached the UI through sonner's
own imperative API. Replacing the toast with a real Dialog (v7.58) removed that
escape hatch: a Radix dialog is a component, and a component needs state.

Three ways to connect a non-React module to the tree, and two of them were
already ruled out by this repo:

- **A window `CustomEvent`.** Forbidden. The AppShell dismantle explicitly lists
  killing the existing ones (`text-committed`, `text-annotations-changed`) as a
  stage, and says new ones are not to be added. They are untyped, invisible to
  the type checker, and impossible to find from the consuming side.
- **A Zustand store.** Available, and the wrong shape here. The stores model
  *application* state — tools, gallery, UI — and are persisted, validated and
  tested as such. The update prompt's state is one nullable callback owned by the
  PWA layer; putting it in a store would move PWA concerns into the store
  vocabulary and invite it into `partialize`.
- **`useSyncExternalStore`.** React's own answer for exactly this.

## Decision

**Module-level state plus a `subscribe`/`getSnapshot` pair, read through
`useSyncExternalStore`.** The state stays in the layer that owns it; React
subscribes.

`lib/pwa/updatePrompt.ts` holds the pending callback and exports
`subscribeUpdatePrompt` / `isUpdatePromptOpen` / `showUpdatePrompt` /
`acceptUpdatePrompt` / `dismissUpdatePrompt`. `components/UpdatePrompt.tsx` is
the only React-aware file and does nothing but render.

Two details that are part of the decision, not incidental:

- **The snapshot is a boolean, not the callback.** `getSnapshot` must return a
  stable value between changes or `useSyncExternalStore` re-renders forever. The
  callback is held privately and invoked by the actions.
- **The state lives in the owning layer, not in a shared "external stores"
  folder.** The whole point is that the PWA surface stays inside `lib/pwa` the
  way it did when it was a toast.

## Consequences

- The triggers did not change. `swBoot.ts` and `skew.ts` call one function, as
  before, and neither knows React exists.
- Testable without a renderer: the semantics (one prompt at a time, "No" clears
  the latch so a later trigger can re-offer, "Yes" clears before running the
  callback so a throwing callback cannot leave a stuck prompt) are all module-
  level and were driven directly in a browser through the live module.
- **A trap worth recording**, hit while verifying #14: driving such a module from
  the console with `await import('/src/…')` gets a *different instance* than the
  app's under Vite HMR, which versions modules by query string. The store looked
  like it was ignoring the UI. Test through the real UI, or accept that a
  dynamically imported module is a second copy.
- This is now the pattern for any future "something outside React needs to say
  something to the user". If a third case appears, the subscribe/snapshot
  boilerplate is worth a tiny shared helper — two is not yet enough to abstract.

## Alternatives rejected

Covered above: window `CustomEvent` (forbidden here), a Zustand store (wrong
ownership, and would drag PWA state into persisted-store territory). A fourth —
lifting the state into AppShell and passing callbacks down into `lib/pwa` —
inverts the dependency and puts more into the file that is being dismantled.
