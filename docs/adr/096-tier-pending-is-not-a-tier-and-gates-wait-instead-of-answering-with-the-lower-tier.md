# ADR-096: Tier pending is not a tier, and gates wait instead of answering with the lower tier
Date: 2026-10-27   Status: draft (`fix/tier-pending`, PR #415)

## Context

Between "Clerk says signed in" and "`users.me` answered", `useRealTier()`
returned `null`, which `userModeForTier` maps to `loggedIn`. Every gate
read that as the user's tier, so a paid user saw "24 max", the OCR panel's
"needs a Paid plan" note, and "Layer limit reached" until the query landed
(PARKING_LOT, 10-11-2026). Red-first test with `users.me` 2 s late: the
count read "3 photos · 24 max" at 100 ms.

## Decision

1. **Not answered is its own value.** `useRealTier()` returns `undefined`
   until `users.me` answers; `null` stays a real answer (no row, no tier).
2. **A flag, not a mode.** `tierPending` in useUIStore (not persisted) is
   true while signed in and unanswered, capped at `TIER_PENDING_MAX_MS`
   (10 s). After the cap the app decides with the free tier, as before,
   and logs a `CONVEX_DB` diagnostic. Signed out and keyless demo builds
   never wait.
3. **What is allowed does not change.** The mode stays `loggedIn` while
   pending, so no tier gains a capability. Only WHEN a gate decides changes:
   - GalleryCount: max is an empty box for 300 ms, then a `line` Skeleton
     sized to "100" (measured 35.61 px both ways, so "max" does not move).
   - OCR: paid note and lock hidden; the button stays disabled.
   - AISettings: a press says "Checking your plan. Try again in a moment."
   - Layers: the lower limit still applies, without "Layer limit reached".
   - Gallery add / duplicate (`decideGalleryCap`): decide at once if the
     result fits the lower cap, otherwise wait for the tier, then cap.
4. **Structure.** The mode watcher left AppShell for
   `app/session/useUserMode.ts` (AppShell 3225 → 3151, eslint cap lowered).
   `AUTH_ENABLED` is replaced by `CLOUD_CONFIGURED` (`lib/cloud.ts`), which
   reads the same two env vars.

## Consequences

+ A paid user no longer gets told they are free, or pitched a plan they own.
+ No gate grants anything earlier than before; the server still decides.
- A second axis every tier gate must remember to read. Nothing enforces it,
  and the Storage pane already misses it (reads `me` directly, still flashes).
- An add that the lower cap would trim waits up to 10 s with no progress cue.
- A free user sees a skeleton instead of "24" for the query, and the box
  then narrows by one digit (35.61 → 28.41 px).

Parked (PARKING_LOT): the Storage pane flash; the pre-Clerk "demo" window
(12 max behind the splash); OCR's disabled-then-enabled button.

## Alternatives rejected

- **A fourth user mode, "pending":** every mode switch and capability table
  (`TIERS`, `effectiveMode`, Super User preview) would have to handle it.
- **Optimistic paid:** grants capability before the server proves it.
- **Keep the flash:** the wrong answer, shown to the users who pay.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the
flag is opt-in. New gates read `TIERS[userMode]` and never `tierPending`,
so the flash comes back one panel at a time, and the record says it was
fixed. A fourth mode would have broken those gates loudly at the type
level; a boolean breaks them silently.
Early warning sign to watch for: a new `TIERS[` or upgrade-prompt read in
`app/src` without a `tierPending` read beside it, or the "users.me did not
answer in 10000 ms" diagnostic showing up in real sessions.
