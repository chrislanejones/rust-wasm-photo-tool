# UI Nights 16–19: skeletons for the surfaces Nights 9–15 did not reach

Nights 9–15 (shipped in v9.27) covered the gallery, Welcome Back, Shared,
Shared links and Batch. A survey on 10-11-2026 found the remaining surfaces
that load an **existing** resource with nothing, a spinner or a "Loading…"
line. The rule is unchanged (docs/UI_CONSISTENCY.md): waiting for something
that exists → skeleton; Image Horse working on something new → progress.

Every night reuses `Skeleton` / `SkeletonText` (`components/ui/skeleton.tsx`),
`useDelayedFlag` (300 ms grace), and `DecodedImage` where an image decodes.
Reserve the final footprint at once; paint the grey only after the grace.

## Plan

| Night | Surface | Now | Change |
|---|---|---|---|
| **16** | Sign-in / avatar slot (`UserMenu`, 5 render sites) | Empty until Clerk loads, then pops in | **Done**: `ClerkLoading` reserves the slot, decorative skeleton after 300 ms |
| **16** | Settings › AI Usage | "Sign in to see your usage" flashes at signed-in users, then a "Loading your usage…" line | **Done**: card-shaped skeleton while auth connects or the query is in flight |
| **17** | Compare slider (`features/canvas/CompareSlider.tsx`) | Renders nothing until the original is read from IndexedDB; the before half can be blank until its CSS background decodes | **Done** (#350): decoded off-screen before reveal; skeleton clipped like the before layer; "Original unavailable" on failure or after 15 s |
| **18** | Mobile full-screen viewer (`MobileShell.tsx` ~302) | Spinner at once, no grace; each swipe pops in | **Done** (#353): photo-shaped skeleton from the known size after the grace; "This photo couldn't be loaded." on failure |
| 18 | Mobile boot (`MobileShell.tsx` ~441) | Logo + spinner | 3-column tile grid skeleton. **Chris's call**: the spinner doubles as the brand screen |
| 19 | Import dialog preview (`ImportImageDialog.tsx`) | Bare `<img>`; the frame collapses, then grows | `DecodedImage` in a box reserved from the known width/height |
| 19 | Diagnostics › Image meta EXIF | "reading…" text | `SkeletonText`. The hash stays "computing…": that is new work |
| 19 | MasterBar lazy chunk (≤1000 px) | `Suspense fallback={null}`, the 252 px bar pops in | Optional: a sized fallback |

## Not in these nights

| Item | Why |
|---|---|
| Settings › Plan & Billing spinner | **Done** (#352), Chris chose skeleton on 10-11. Full-pane shape, not the small inline one the spinner replaced. Also fixed: a keyless build showed it loading for good |
| Gallery "· N max" while the tier loads | A gating problem, not a skeleton: a paid user is `loggedIn` until `users.me` lands. In PARKING_LOT |
| TrashView thumbnails | Not rendered anywhere in the app. Use `DecodedImage` if it is ever wired |

## Night 16: auth slots

Problems confirmed:
- `UserMenu` rendered neither `<SignedIn>` nor `<SignedOut>` while Clerk loaded,
  so the slot was empty and the control popped in.
- `AIUsagePane` read `isAuthenticated` only. While Convex auth connects that is
  `false`, so a signed-in user saw the signed-out copy first.

Changes:
- `UserMenu.tsx`: `<ClerkLoading>` renders `AuthSlotSkeleton`, sized per site
  (avatar 32/36 px circle, 64 px tile for `large`, 92×36 for `labeled`).
  Decorative: the arriving button carries the label, and a toolbar slot that
  says "Loading" on every boot is noise. The `large` slot uses `rounded-lg`, not
  the tile's `rounded-xl`, which the radius ratchet freezes.
- `AIUsagePane.tsx`: `loading = authLoading || (isAuthenticated && usage === undefined)`
  shows `UsageSkeleton`, the Usage limits card's shape, with one `role="status"`.

Tests: `UserMenu.loading.test.ts` (6) and `AIUsagePane.loading.test.ts` (5).
Against the old code: 5 of 6 and 3 of 5 fail; all pass with the change.

Browser (production build, placeholder Clerk key, so Clerk never finishes):
the skeleton sits in the upload card's footer at 32×32, beside the link,
GitHub and Vercel buttons, in both themes. When Clerk gives up, `ClerkLoading`
unmounts and the skeleton goes with it, so a failed load never pulses forever.

Gates: app tsc clean; lint 0 errors (55 existing warnings); guardrails OK; 191
files / 1,875 unit tests pass; production build and inert-class audit (0) pass.
Engine untouched (892,897 B).

Risk: the signed-in look of both skeletons has not been seen against a real
Clerk/Convex session. imagehorse-qc is required before release.

## Night 17: Compare slider (#350)

`useOriginalImage` decodes the original off-screen and keys readiness and
failure to its URL. Nothing for 300 ms, then a skeleton clipped to the Original
half; "Original unavailable" sized to that half on a decode error or after 15 s.
Browser, decode slowed to 3 s: nothing at 100 ms, skeleton at 800 ms, photo at
3 s. The first version centered the failure message on the whole photo, and the
divider cut it to "Origina"; caught in the browser and fixed. 8 hook tests.

## Night 18: phone viewer (#353)

`useViewerOriginal` reads, decodes and keys each result to the photo it was read
for, so a swipe never pairs the new name with the old picture. The skeleton
takes the photo's own box from `origWidth`/`origHeight` (`viewerBox`, `cq`
units on the stage). Browser at 390×844: skeleton 390×293, photo 390×293.
A missing original used to spin for good; it now says so. 13 tests; the old
viewer fails 3 of 4. The phone boot screen is unchanged (Chris's call).

## Plan & Billing (#352)

Full-pane skeleton (Current plan row, Pro card) instead of a spinner. Browser
testing found that a keyless build answers every query with `undefined`, which
held the pane loading for good, on master too. It now waits only while auth
connects or a signed-in user's plan is in flight. 6 tests.

## Released together in v9.28

Night 16's skeleton in the phone header broke three phone-grid browser specs
that counted every `.skeleton` on the page; CI's placeholder Clerk key never
finishes loading. The specs now count the grid's own placeholders.
Combined master: 1,902 unit tests; tsc, lint (0 errors, 55 warnings),
guardrails, build and inert-class audit pass. Engine unchanged (892,897 B).
Night 19 is still to do.
