# ADR-063: A share link stops itself by derived limits, keeps each view as a bare timestamp, and a scheduled write makes its end date real
Date: 2026-09-22   Status: draft

## Context
Once a share link was copied, its owner could never see it again. `shares.listMine`
had existed since the table was made ("for a future My links pane") with zero
callers. Live deployment `brave-ant-608` on 09-22-2026: 3 links from 2 old test
accounts, views 1 / 2 / 1. Chris, 09-22-2026: "do something cool with shared
files + views … Settings › Shared (new menu item) … maybe someone might wanna
revoke it after a certain amount of shares". His picks: a view limit and an end
date, set afterward in Settings › Shared rather than at creation. Reaching a limit
PAUSES the link (image kept, resumable), and Delete stays its own act.

## Decision
1. **Stop state is derived, never stored.** `shares` gains five optional fields
   (`maxViews`, `expiresAt`, `pausedAt`, `lastViewedAt`, `expiredAt`). They are
   optional because Convex validates every existing row on push. One pure
   `availability(share, now)` returns live | paused | expired | views, checked in
   that order, and `get`, `recordView` and `listMine` all call it. Raising a cap
   un-stops a link with no extra write. Pause has its own field so the status can
   say which stop it is.
2. **Public `get` returns a union.** A live link returns the pre-feature fields
   exactly, plus `status: "live"`, so the v8.86 client keeps working against the new
   backend. A stopped link returns `{ status: "unavailable", reason, title,
   createdAt }` with no `imageUrl`: the server withholds the image. `recordView`
   does nothing unless the link is live. The Nth view of an N-view link counts;
   the view after it is refused.
3. **A view is a timestamp and nothing else.** Each counted view inserts one
   `share_views { shareId, at }` row, indexed `by_shareId [shareId, at]`. No IP,
   no browser, no account, and `PrivacyPolicy.tsx` now says exactly that.
   `listMine` builds 30 UTC-day buckets per link from an index range
   (`at >=` window start), never a scan.
4. **A scheduled write enforces the end date.** A Convex query "is not re-run when
   `Date.now()` changes" (Convex best practices). So a cached `get` would keep
   answering "live", with the image URL, past the end date until something wrote
   the row. View caps and Pause are safe because each one writes the row.
   `setLimits` clears `expiredAt`. For a future date it also calls
   `ctx.scheduler.runAt(expiresAt, internal.shares.expire, …)`. The job stamps
   `expiredAt` only if `expiresAt` still equals its scheduled `at`. A past date
   schedules nothing, because the `setLimits` patch is already the write. Nothing
   reads `expiredAt` to decide anything; it exists to be written.

UI: Settings › Shared (`#/settings/shared`, palette "Shared Links") shows totals
and one card per link: status, "N views of M · last opened · stops MM-DD-YYYY", a
30-day bar row, limits with Save, Copy, Pause/Resume, and Delete behind
`ConfirmDialog`. Every control takes effect immediately; none waits for Settings
Apply. "Stop on" stores the owner's local midnight at the START of that day. The
viewer names the stop reason and counts no view on a stopped link.

## Consequences
+ Every stop is computed from stored numbers by one rule, so no flag can
  disagree with them. The functions were on `brave-ant-608` before merge: 77
  functions, 4 new (`setLimits`, `pause`, `resume`, internal `expire`), none
  removed.
+ 37 new tests: `shareLimits.test.ts` 32 (the rule, the buckets, and the handlers on
  an in-file fake of `db` / `storage` / `scheduler`) and `SharedPane.test.ts` 5.
  Disabling the schedule turns 2 red.
- `share_views` grows one row per view forever. Only `remove` deletes rows, and
  only for the link it deletes.
- `listMine` costs each owner their view rows from the last 30 days. A 100k-view
  link makes that owner's pane heavy; the fix would be per-day rollup rows.
- Days are UTC, so an owner's "today" bar is off by their UTC offset.
- The scheduler is one more moving part. Moving or clearing a date leaves the old
  job queued, and it does nothing when it runs.
- Views from before this change have no `share_views` rows (0 on 09-22-2026).
  The 3 old links show 1 / 2 / 1 over an empty chart, visible only to those 2
  test accounts.
- The v8.86 viewer would draw a stopped result as a broken image. That is safe
  only because nothing except the new pane can stop a link, and both ship
  together.

## Alternatives rejected
- **A stored `stopped` flag written on the Nth view:** raising the cap would need
  an un-stop write, and the data would have two sources of truth.
- **Delete when a limit is reached:** Chris chose pause.
- **A rounded clock passed to `get` (Convex's other suggestion):** `get` is public
  access control, and the client controls that argument.
- **A cron that sweeps for expired links:** it polls every row. The per-link job
  fires at the exact instant and touches one row.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the end date
is enforced in two places, the clock check in `availability` and the job that only
`setLimits` schedules. Chris deferred limits at creation, which makes them the
obvious next feature. If `create` starts writing `expiresAt`, or a migration or
the dashboard writes it, no job is scheduled. A cached `get` then keeps serving
the image past the date, and no test fails, because the tests drive `setLimits`.
A viral link is the other way this goes wrong: `share_views` has no retention,
so one popular link slows its owner's pane first and then hits Convex's
per-query read limit.
Early warning sign to watch for: a `Date.now()` comparison that gates access in a
query with no matching scheduled write, an `expiresAt` write outside `setLimits`,
or `share_views` gaining any field besides `shareId` and `at`.
