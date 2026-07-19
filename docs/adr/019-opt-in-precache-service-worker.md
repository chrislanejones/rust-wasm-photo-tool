# ADR-019: The app shell ships behind an opt-in, precache-only service worker
Date: 2026-07-19   Status: draft

## Context
Every visit re-downloads the full app shell — ~3.6 MB across 9 assets,
including the 734 KB WASM engine — and a network drop mid-session means
the next boot fails entirely, despite all user data living locally in
IndexedDB. A service worker fixes both, but a wrong one is the worst bug
class we ship: it strands users on stale builds invisibly.

## Decision
`vite-plugin-pwa` (generateSW), precache-only: hashed assets + WASM +
app shell, `registerType: 'prompt'` (a new build waits for an explicit
Reload — never `skipWaiting` under an active editing session), zero
`runtimeCaching` — Clerk, Convex, share URLs and all APIs pass through
untouched; IndexedDB is not involved. Opt-in and dark by repo
convention: only `VITE_ENABLE_SW=1` at build time emits or registers
anything; a default build carries zero SW bytes. `VITE_ENABLE_SW=kill`
emits a self-destructing sw.js — the only correct way off once "on" has
shipped. A per-build hash lives in both the bundle and a never-precached
`version.json`; mismatch (stale cache serving old JS/WASM) raises the
update toast and one console.error.

## Consequences
+ Repeat loads and offline boots serve ~3.6 MB from Cache Storage;
  the editor works with no network, matching its local-first data story.
+ Update prompt + hourly `registration.update()` + skew guard give three
  independent paths to noticing a new build.
- A service worker is now a production state to manage: every deploy
  path must understand on/off/kill, and eviction takes a full deploy.
- The prompt is ignorable forever; nothing forces an update short of the
  kill build (see Pre-mortem).
- Two e2e harnesses (default + SW build) — CI time roughly doubles for
  the e2e stage.

## Alternatives rejected
1. `autoUpdate`/`skipWaiting` — reloading or swapping code under an
   active editing session risks losing uncommitted canvas state; the
   exact failure mode this app cannot have.
2. Runtime caching (stale-while-revalidate etc.) — caching Clerk/Convex
   responses risks serving stale auth or stale documents; precache of
   build-hashed immutable assets is the only cache with a correctness
   proof.

## Pre-mortem
It is six months later and this decision was a mistake. Most likely
reason: users sat on a stale build for weeks — the toast was dismissed
and forgotten, a deploy went out with the flag accidentally UNSET
instead of `kill`, and the installed SW kept serving the old shell with
no code left in the new build to evict it; meanwhile the stale WASM
wrote op-logs a newer schema had already migrated past.
Early warning sign to watch for: `[pwa] build skew detected` errors in
the console (or user reports of "missing" recently-shipped features) —
each one is a session running JS older than the deployed version.json.
Mitigation already in place: never-unset-always-kill is documented in
vite.config.ts and enforced socially by this ADR; the skew banner
re-raises on every engine init, not just boot. Proposed if it recurs:
count dismissals and escalate the toast to a blocking dialog after N
ignored prompts on distinct days.
