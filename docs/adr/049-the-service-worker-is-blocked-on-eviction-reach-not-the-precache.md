# ADR-049: Activating the service worker is blocked on eviction reach, not on the precache
Date: 2026-09-07   Status: draft

Successor to **ADR-019** (Accepted 2026-07-19), which stands. That ADR decided
the *shape*; this one investigates what turning it on would actually cost, and
finds the blocker is somewhere other than where it was being looked for.

## Context

ADR-019 has shipped dark for 50 days. The marketing site promises precaching in
visible copy while zero registrations exist, and nobody had written down what
activation would do. This is an investigation, read out of the code rather than
inferred from the ADR — and the code is in better shape than the question
assumed.

Two numbers moved since ADR-019 was written: the engine is **817,392 B**, not
the 734 KB quoted there (+11%), and the precache ceiling is 40 MiB, so growth is
not near a cliff.

## What is actually built

| Property | Setting | Consequence |
|---|---|---|
| Strategy | precache-only, **no `runtimeCaching`** | Clerk, Convex, UploadThing, share URLs all pass through |
| Update | `registerType: "prompt"`, `skipWaiting: false` | A new build **waits**; an editing session is never yanked |
| Precache glob | `js,css,html,wasm,svg,woff2` | `.json` excluded, so `version.json` **and** `build-info.json` are never cached |
| Skew guard | `version.json` `globIgnores` + `no-store` fetch vs `__IH_BUILD_HASH__` | Fires at boot **and at engine init** — where stale WASM would start work |
| Escape hatch | `VITE_ENABLE_SW=kill` self-destructing `sw.js` | Wipes caches, unregisters, reloads clients |
| Fallback | `navigateFallback: "/index.html"` | SPA routing; share links are `?v=` on the same shell |

## The sentinel collision, as actually found

The concern was that a cached WASM would break the deploy sentinel's tier 1 —
which asserts the site serves the file its build wrote — while `curl` still
passed, leaving the check blind to the failure it exists to catch.

**The first half is true and the conclusion does not follow.** The sentinel
fetches over `curl` with no service worker, so it can never observe client-side
staleness. But that is not a blindness the SW introduces; it is a different
failure class. The sentinel catches *server-side* staleness (stale CDN, partial
deploy, featureless build). The skew guard catches *client-side* staleness, and
it was built for exactly this case: `version.json` is deliberately excluded from
the precache so a cached copy can never agree with cached JS, it is fetched
`no-store`, and the comparison runs again at engine init. Two checks, two
classes, and the SW-shaped hole already has a plug.

`build-info.json` is likewise outside `globPatterns`, so tier 1 keeps reading the
network even in a browser with the SW active. Nothing to change there.

**The genuine gap is that neither guard runs anywhere automatic.** `e2e/sw/`
holds five tests — registration, precache contents, offline reload, hash
mismatch raising exactly one `console.error`, and matching hash staying silent —
and `ci.yml` has **nine jobs, none of which run Playwright**. The safety net
ADR-019 leans on is hand-run only. That is the same shape as the trap CLAUDE.md
already documents about `guardrails.sh`: a gate nobody runs is worse than no
gate, and this one guards the failure mode the pre-mortem calls the worst class
we ship.

## CSP interaction — clear, with one caveat

Checked against the policy live today (report-only):

| Directive | Effect on the SW |
|---|---|
| `worker-src 'self'` | Covers service workers; `/sw.js` is same-origin. **OK** |
| `script-src 'self' 'wasm-unsafe-eval'` | `generateSW` emits a sibling `workbox-<hash>.js` loaded by `importScripts` — same-origin, allowed |
| `default-src 'self'` (inside the SW) | Headers apply at `/*`, so the worker inherits them; precache fetches are same-origin |

The caveat is the one the report stream already found: Clerk mints **blob:**
workers at runtime, which `worker-src 'self'` does not permit. That is PR #82's
problem, not the SW's — but it is the precedent worth remembering here. Clerk
was invisible to every bundle-level check and only appeared under a live policy;
a service worker deserves the same suspicion, which means **report-only must
still be live when the SW is first switched on**, not flipped to enforcing first.

## Offline scope — verified, and it is the real case for activation

Measured, not argued: the production build served locally with **every
third-party origin blocked** (Clerk, Google Fonts) boots to an identical shell —
same 166 characters of UI text, canvas present, 9 buttons down to 8 (the missing
one is sign-in).

| Works offline | Does not |
|---|---|
| App shell, engine, all editing | Sample Images (`ufs.sh`) |
| Local file open, paste, new canvas | Clerk sign-in, Convex sync |
| IndexedDB originals/edits/gallery | Google Fonts (falls back to system) |

Demo mode being sacred is what makes this work: the logged-out path is the
product, so an offline Image Horse is a genuinely complete editor, not a
degraded one. **This is the strongest argument for activation** and it is now
evidence rather than a claim.

## Decision

**Stay dark.** Not because the precache is wrong — it is well built and better
defended than expected — but because activation is gated on three things that
are not done, in this order:

1. **Run `e2e/sw/` in CI.** Cheapest, and it is the prerequisite for trusting
   anything below. Five tests already written.
2. **Rehearse eviction and measure the tail.** The kill build only evicts a user
   who *visits while it is the current deploy*. ADR-019 says keep it up "for at
   least one full deploy"; nobody has measured how long the returning-visitor
   tail actually is, and that number — not the cache — is what bounds the blast
   radius of a bad activation.
3. **Choose an update path.** Not picked here:

| Option | Buys | Costs |
|---|---|---|
| Keep prompt-only (today) | Never interrupts an edit | Ignorable forever |
| Escalate after N dismissals | Bounded staleness | A dialog that blocks work |
| `skipWaiting` on a fresh tab only | Auto-update where it is safe | Two code paths; "fresh" needs defining |

## Consequences

+ The question is now specific: three gates, not "is a service worker safe".
+ Offline capability is measured, so the marketing copy has something true
  behind it once activation happens.
+ The sentinel needs no change — a conclusion that saves work.
- Staying dark keeps the marketing site promising something that does not run.
- Gate 1 adds a Playwright stage to CI; ADR-019 already priced this as roughly
  doubling the e2e stage, and today that stage costs zero because it is absent.

## Alternatives rejected

1. **Activate now and watch the report stream.** The escape hatch requires a
   deploy *and* a visit; unlike CSP report-only there is no observe-without-risk
   mode. Rejected until gate 2 gives the tail a number.
2. **Delete the SW and the marketing claim.** Cheapest, and it throws away a
   working precache plus a verified offline story for a problem that is
   process, not code.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the three
gates were never done, because none of them is urgent and all of them are
someone's afternoon — so the SW sat dark for another year while the marketing
page kept promising it, and the five e2e tests rotted against a `vite-plugin-pwa`
that had moved on. The second-most-likely reason is worse and faster: gate 1 got
done, gate 2 got skipped as bureaucracy, activation shipped, and a bad build
reached a tail of users nobody had sized — with the kill build already
superseded by the next deploy before they came back.

Early warning sign to watch for: `e2e/sw/` failing to compile against a bumped
`vite-plugin-pwa`, or a `vite-plugin-pwa` bump merging with no Playwright run
anywhere in the PR checks. Either one means the safety net is already gone and
the ADR above is describing a system that no longer exists.
