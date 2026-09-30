# ADR-064: A feature reaches a few people before everyone through a per-device opt-in ring, and nothing about that choice leaves the browser
Date: 2026-09-22   Status: Draft

## Context
Chris, 09-22-2026: "how can you make it so you can test a roll out to a small
amount of users - future thinking". Shipping goes from Chris's machine to
production for everyone with nothing in between. The in-between already existed
in pieces: `lib/featureFlags.ts` registers nine `ih_*` localStorage switches
behind an admin-gated Super User pane — seven kill switches for shipped work and
two genuine opt-in experiments, `ih_smart_edge` and `ih_webgpu`, both compared
`=== "1"` and both off by default. The Smart Brush's own header says why it is
still a switch: the engine side is tested, the FEEL of a stroke is not, "and
there is deliberately no Settings-panel UI for it". But the only way in was
typing a key into DevTools, so the ring was one person wide — everyone who could
opt in already knew the key names. Four options were costed; Chris picked
building ring 2 now, with ring 3 deferred until ring 2 has been used once.

Three rings, as the frame. **Ring 1** is Chris: Super User plus the `ih_*`
switches, already built. **Ring 2** is a handful of invited people, per device,
from Settings — this ADR. **Ring 3** is a percentage of signed-in accounts
flipped from the server, and is deliberately NOT built: it turns a feature on for
someone who never asked, which is a different promise.

## Decision
1. **The ring is a VIEW of the existing flag registry, and names no keys.**
   `featureFlags.ts` already held every `ih_*` key beside the module's own
   predicate; a flag joins the ring by growing a `beta` block there (`id`,
   `label`, `blurb`). `lib/beta.ts` filters for it, reads through `flag.isOn()`
   and writes through `setFlagOverride` — so the pane cannot disagree with the
   behavior, and DevTools still works. ⚠️ The first cut of this DID hold its own
   `{id, key}` list, which is the second-source-of-truth failure that registry's
   own header names; it was found in review before merge and replaced.
   `beta.test.ts` pins the view (it equals the opt-in rows carrying a `beta`
   block), pins that a kill switch is never offered, and still asserts the key
   identity through `isSmartEdgeEnabled()` / `webgpuEnabled()`.
2. **Nothing leaves the device.** A choice here is a localStorage key and no more:
   no account, no id, no request. `lib/sync/identity.ts` records that the
   per-browser device id was deleted because it was uploaded for no feature at all,
   and that a feature needing to tell devices apart has to say so in the privacy
   policy first. Same standard binds this, and it is exactly why a percentage
   rollout of anonymous visitors was not built. No privacy-policy change was needed.
3. **The invite link.** `?beta=smart-brush` (comma-separated ids allowed) opts the
   device in, then `history.replaceState` removes ONLY that parameter — a share
   link's `?v=` token and the `#/...` hash route both survive, pinned by a test.
   `?beta=none` clears every feature: the way out for someone who cannot find the
   pane. Applied ONCE in `main.tsx`, before React renders and before the WebGPU gate
   reads its key, never during a render.
4. **Off is the default and the fallback.** An unknown id, blocked storage, or any
   value that is not exactly `"1"` reads as off. A beta feature that failed open
   would be a feature that shipped without being decided.

UI: Settings › **Beta** (`#/settings/beta`, palette "Beta Features"), one row per
feature with On / Off, a "reload the page" line on EVERY row (the registry says it
of every flag it carries), and **Copy invite link**. Switches commit as
pressed; this pane has no Apply. Verified in a browser against a production build:
opening `?beta=smart-brush` set `ih_smart_edge=1` and left the URL at `/`, the pane
read On, toggling GPU blur wrote `ih_webgpu=1`, and `?beta=none` cleared both.

## Consequences
+ An experiment reaches a named person in one message instead of a paragraph of
  DevTools instructions, so the Smart Brush's open question — does a stroke stop
  where a human expects — can be answered by more than one canvas.
+ Reading the registry to build on it caught a row that had gone stale: the
  `ih_webgpu` line still said "no pixel in the app goes near the GPU yet", which
  stopped being true when whole-image blur grew its GPU path in
  `useTransforms.ts`. Fixed in the same change.
+ 19 new tests (12 `app/src/lib/beta.test.ts`, 5 `app/src/components/BetaPane.test.ts`),
  suite 1099. Five mutations each killed: renaming a registry key off the feature's
  own key, leaving the parameter in the URL, disabling `?beta=none`, not skipping an
  unknown id, and accepting any value as on.
- **A beta switch is a promise that gets kept or deliberately removed.** The
  registry is that list, and an entry whose `key` nothing reads would be a switch
  that lights up and does nothing. Only a test guards it.
- Clearing site data silently opts someone out, with no notice and nothing to
  restore from.
- The choice is per DEVICE, so the same person on a laptop and a phone sees two
  different apps and has to opt in twice.
- **There is no way to know who is in the ring.** That is the point, and it is also
  the cost: no usage signal at all, so feedback has to be asked for rather than
  measured.
- An invite link is a capability anyone can forward, and there is nothing to revoke.
- Ring 3 remains undone, so "turn this on for 10% of users" is still not possible.
- `ToggleButtonGroup` emits no `aria-pressed` (parked, every pane), so the On / Off
  state is visual-only to a screen reader.

## Alternatives rejected
- **Vercel Rolling Releases:** a percentage at the deployment level with no app
  code. It cannot target named people, it puts two commits in production at once —
  which breaks the deploy sentinel's and the git routine's one-live-commit
  assumption — and it rolls out a build, never one feature.
- **Convex flags per account:** that is ring 3, deferred rather than dismissed.
  Signed-out users get nothing from it, and the app working logged out is a project
  invariant.
- **A local percentage bucket:** needs a stable per-device number, which is exactly
  the identifier `identity.ts` deleted, and the percentage cannot be re-dialed
  without a deploy.
- **Leaving the experiments in DevTools only:** the status quo, and the thing that
  made the ring one person wide.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the registry
drifted from the code. Adding a row is cheap and deleting a finished experiment is
nobody's job, so `BETA_FEATURES` accumulates ids whose modules have since shipped
the feature by default or dropped it — a tester turns on a switch that does nothing,
reports it as broken, and the pane loses the only thing it had, which is that every
row is real. The key-identity test covers only the entries someone wrote it for. The
second way this goes wrong is a beta key read during a React render instead of at
boot or through `subscribeBeta`: half the tree sees on and half sees off, which is
the same purity rule `identity.ts` cites from ADR-020.
Early warning sign to watch for: a `BETA_FEATURES` entry whose `key` no module
reads, an `isBetaOn` call in a render body, or a second place that writes `ih_*`
keys.
