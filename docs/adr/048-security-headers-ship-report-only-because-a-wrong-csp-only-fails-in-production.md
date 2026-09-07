# ADR-048: Security headers ship, and the CSP ships REPORT-ONLY because a wrong one only fails in production
Date: 2026-09-07   Status: draft

## Context

Both sites sent `Strict-Transport-Security` and nothing else — no
`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` or
`Permissions-Policy`. Found in the 2026-09-02 security pass and carried
unowned for six days, because the CSP half is genuinely risky in a way the
other headers are not.

**Nothing in this repo can catch a wrong CSP.** `tsc`, vitest, eslint,
guardrails, the production build and the deploy sentinel all pass on a policy
that breaks the editor, because none of them serves these headers. The first
signal is a blank canvas on the live site.

## Decision

**The four uncontroversial headers are enforcing immediately**:
`nosniff`, `strict-origin-when-cross-origin`, a `Permissions-Policy` denying
camera/microphone/geolocation, and `frame-ancestors 'none'` inside the policy.
None of them can break a working page.

**The CSP ships as `Content-Security-Policy-Report-Only`** and stays that way
until a human has driven a real editing session and read the report stream.

### The two directives that would kill the editor

| Directive | Why | How it was established |
|---|---|---|
| `'wasm-unsafe-eval'` in `script-src` | the engine is WebAssembly and instantiating it counts as eval to CSP; without it the canvas never appears | the whole product is the wasm engine |
| `worker-src 'self'` — **not** `blob:` | both workers are Vite's `new Worker(new URL(…, import.meta.url))` pattern, which emits same-origin asset files | **measured**: `/assets/engine.worker-BxZey_uo.js` and `/assets/codec.worker-BC0cZvq4.js` both return 200 from the live site |

⚠️ **`blob:` for workers was assumed necessary and is not.** It is left out
deliberately. Adding a directive "just in case" is how a policy stops meaning
anything, and report-only is exactly where a wrong guess surfaces without
costing anyone an editor.

`blob:` *is* required in `img-src` — every thumbnail, preview and export is a
`URL.createObjectURL` blob (8 call sites).

### Origins, inventoried from a live session

Read out of `performance.getEntriesByType('resource')` on the deployed app
after loading photos and painting a stroke — not inferred from imports:

| Origin | What needs it |
|---|---|
| `self` | app, assets, wasm, both workers |
| `*.clerk.accounts.dev` | auth (the dev instance; production talks to it too) |
| `*.convex.cloud` + `wss:` | backend, both deployments the bundle carries |
| `*.ufs.sh` | UploadThing — the sample images come from here |
| `fonts.googleapis.com` / `fonts.gstatic.com` | font CSS and font files |
| `cdn.jsdelivr.net` | ⚠️ see below |

⚠️ **`cdn.jsdelivr.net` is the one I could not reproduce live.** The shipped
bundle contains a runtime fetch of `@emoji-mart/data@latest/sets/…`, so the
emoji picker pulls its data set from jsdelivr on open. I could not trigger it
in the session (`#/create/emoji` is the *Batch* tool — the id/label mismatch
this repo carries as known debt). It is in the policy on the strength of the
bundle. **If the report stream never mentions jsdelivr, the line can go.**

The marketing site is a static Vite build with no engine, no workers and no
Clerk or Convex, so its policy is much tighter — `default-src 'self'` with
fonts, and nothing else.

### One config per site, not two

The headers go in `netlify.toml` (app) and the **root** `vercel.json`
(marketing). Not `marketing/vercel.json`: the root file is the single source of
truth for that deploy, because Vercel's project Root Directory is not reliably
scoped to `marketing/` — a lesson this repo has already paid for twice
(`project_vercel_marketing_deploy`). Putting headers in both would recreate the
two-sources-for-one-build failure that has bitten the wasm-pack pin and the
Netlify build command.

## Consequences

+ Four real headers on both sites today, at no risk.
+ The CSP is measurable before it is enforced: the report stream says what a
  real session actually violates.
+ The origin inventory is written down, so the next person editing the policy
  is not guessing.
- **A report-only policy protects nobody.** It is a step, not a fix, and it is
  worthless if nobody reads the reports and flips it. That is the whole risk of
  this ADR and the reason the follow-up is named explicitly below.
- No `report-uri`/`report-to` endpoint is configured, so violations land in the
  browser console rather than anywhere collectible. For a single-operator app
  driven by hand that is enough to start; a collector is the obvious next step
  if the policy ever covers more surface.

## Follow-up, and it is the point

1. Deploy this. Drive a **full editing session** on the live app with the
   console open: load a photo, paint, use shapes and text, open the emoji
   picker, sign in, export.
2. Every violation is either a missing origin or a real finding. Fix the
   policy, not the app, unless the app is doing something it should not.
3. When a session produces **zero** violations, rename
   `Content-Security-Policy-Report-Only` to `Content-Security-Policy` on both
   sites. That is a separate PR with its own deploy.

## Pre-mortem

It is three months later and this was a mistake. Most likely reason: it never
got past report-only. The headers sat there looking like security work while
the CSP reported into a console nobody opened. **The warning sign is this ADR
still saying "Draft" with no follow-up PR against it.**

Second most likely: someone hit a violation, added a directive to silence it
without reading what it was, and widened the policy until it permitted
everything. A CSP that allows everything is worse than none, because it looks
like protection on an audit.
