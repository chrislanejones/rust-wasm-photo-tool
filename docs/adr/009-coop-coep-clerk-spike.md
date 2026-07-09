# ADR-009 — COOP/COEP cross-origin isolation is compatible with Clerk sign-in

- **Status:** Draft
- **Date:** 2026-07-09
- **Deciders:** Chris (spike run by Silas, Rust/WASM agent)
- **Supersedes:** —

## Question

With `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` set on the vite preview
server: (a) does the app boot, (b) does the WASM module (`stamp_tool`)
load, (c) does `window.crossOriginIsolated === true` /
`SharedArrayBuffer` become available, and (d) does Clerk sign-in work?
This gates the whole rayon/threading roadmap (`wasm-bindgen-rayon` →
parallel blur/resize/denoise + 4 downstream features) — SharedArrayBuffer
requires cross-origin isolation, and isolation requires these headers on
every response.

## Timebox

2 hours, spike branch `spike/coop-coep-clerk` off `master@d9960f6`
(v7.8), worktree `~/ai-repo/ih-spike`. Resolved within budget — this ADR
reflects the live result, not a timeout.

## Result

**Empirically verified via a live headless browser**, not just header
inspection or documentation reading. No `clerk-testing` skill exists in
`~/.claude/skills/` (checked, absent) and Playwright is not installed
anywhere in the repo or system (`node_modules`, `package.json`
devDependencies, and a global search all came up empty) — installing it
would have added a new dependency, which the spike's guardrails forbid.
Instead, the already-installed system `google-chrome` (150.0.7871.46)
was driven headless (`--headless=new --remote-debugging-port=9222`) via
raw Chrome DevTools Protocol over Node's native `WebSocket` global (Node
25.2.1) — zero new npm packages, the driver script lives in the session
scratchpad, not the repo.

Setup: `app/vite.config.ts` gained a `preview.headers` block, COOP fixed
to `same-origin`, COEP driven by a `SPIKE_COEP` env var so
`require-corp`, `credentialless`, and an `unsafe-none` control could be
tested without re-editing the file. **2026-07-09 correction:** the
original patch defaulted to `require-corp` when `SPIKE_COEP` was unset —
since `vite preview` is the imagehorse-qc target, not a spike-only
surface, that would have silently changed default QC headers. Fixed to
be a true no-op unless `SPIKE_COEP` is explicitly set; the preview block
is entirely omitted otherwise. Not wired into `server` (dev) or any prod
config. Production build (`pnpm run build:wasm && pnpm run build`)
served via `vite preview` on three ports, one per COEP mode.

**require-corp** (port 4173):
- `window.crossOriginIsolated` → `true`, `typeof SharedArrayBuffer` →
  `"function"` (both empirically read from the live page, not inferred).
- App boot screen renders normally (upload/paste/sample/blank-canvas UI,
  logo, footer links) — 618 chars of body text, `#root` populated, zero
  console exceptions.
- `stamp_tool_bg-*.wasm` served `200 application/wasm` on every request
  observed. Clicking "Sample Images" drove a real image load (canvas
  resized from its default to real image dimensions) with zero
  exceptions and zero WASM-related network failures — the engine ran
  its decode path under isolation.
- Clicking the sign-in trigger (`UserMenu.tsx`'s `<SignInButton
  mode="modal">`) opened Clerk's modal **fully rendered in-page, zero
  iframes** — email + password fields, "Continue with Google" OAuth
  button, "Secured by Clerk" branding all present and interactive (3-4
  `<input>` elements found in the DOM).
- Every cross-origin Clerk resource loaded clean: all `clerk-js` JS
  chunks (`clerk.browser.js`, `framework_`, `vendors_`, `ui-common_`,
  `signin_`, `signup_`, `waitlist_`, `subscriptionDetails_`) and
  `img.clerk.com/static/google.svg` returned `200` with
  `Cross-Origin-Resource-Policy: cross-origin` +
  `Access-Control-Allow-Origin: *`. Clerk's API calls
  (`/v1/environment`, `/v1/client`) returned `200` via CORS with
  `Access-Control-Allow-Origin: <exact localhost origin>`. **Clerk's own
  CDN already ships the CORP/CORS headers COEP:require-corp demands —
  nothing was blocked.**
- Google Fonts (`fonts.googleapis.com` stylesheet, referenced from
  `index.html`) loaded with zero failed/blocked network events and zero
  non-2xx responses on the cold first navigation.
- The only failed request seen (`clerk-telemetry.com/v1/event →
  net::ERR_ABORTED`) reproduced **identically under the `unsafe-none`
  control** (COEP fully disabled) — it is the fire-and-forget analytics
  beacon getting cut off when the headless tab closes, not a COEP
  effect. Confirmed by re-running the same check under `unsafe-none` and
  seeing the same abort.

**credentialless** (port 4174): identical results to require-corp —
`crossOriginIsolated: true`, `SharedArrayBuffer` available, Clerk modal
renders identically, all Clerk resources clean.

**unsafe-none control** (port 4175): `crossOriginIsolated: false`,
`SharedArrayBuffer` unavailable, as expected — this validates the test
harness itself (the COEP header is genuinely what's driving the
isolation flag, not a false positive from Chrome's flags or the profile).

## What was NOT empirically verified (gaps, stated plainly)

- **Full credential submission → authenticated session.** No test Clerk
  account/credentials were available — no `clerk-testing` skill exists
  in this checkout to source one, provisioning a throwaway account
  needs email verification with no inbox access from this sandbox, and
  the guardrails forbid real production credentials. The entire
  pre-auth chain (script load, CORS API calls, modal render, form
  interactivity) was observed clean; the final `POST
  /v1/client/sign_ins` step is **inferred, not observed** — it is a
  same-origin-to-Clerk CORS call structurally identical to the
  `/v1/environment` and `/v1/client` calls already verified working, so
  there is no structural reason to expect it to behave differently, but
  this is inference.
- **The "Continue with Google" OAuth popup path was not exercised.**
  Popup-based OAuth relies on `window.opener`/`postMessage` across
  origins, which is exactly the mechanism `COOP: same-origin` can
  interfere with (it severs `window.opener` from cross-origin popups by
  design). This is a real, untested risk area, separate from the
  require-corp/CORP question — flag before shipping any COOP change
  that also affects the interactive (non-modal-embed) OAuth flow.
- **Convex websocket activity was not observed** in the ~3s anonymous
  boot window — the app is designed to work logged-out, so Convex may
  simply not connect pre-auth. Not a negative signal, just untested;
  needs a check post-authentication if this proceeds.
- Font *file* (`fonts.gstatic.com`) requests weren't captured on repeat
  navigations in the same Chrome profile (browser HTTP cache from the
  first load suppressed the network events) — the cold first-load
  evidence (zero failures, zero non-2xx) stands, but a fresh-profile
  re-check would close this gap if it matters.

## Verdict

**The rayon-threading branch may proceed.** COOP:
same-origin + COEP: require-corp (or credentialless — both tested
clean) does not break Clerk's sign-in UI, does not break `stamp_tool`
WASM loading, and does deliver `crossOriginIsolated === true` +
`SharedArrayBuffer`, which is what `wasm-bindgen-rayon` needs. This is
not blocked.

Recommend **`credentialless`** over `require-corp` as the default if/when
this ships for real: it is empirically equivalent here today, but is the
more forgiving mode for any future cross-origin embed that doesn't
control its own CORP header (Clerk already does; a future third-party
embed might not) — `credentialless` degrades gracefully (drops
credentials on such requests) instead of hard-blocking them.

Before this leaves spike status and lands on any real config:
1. Provision a real Clerk test account and complete one actual
   sign-in round trip (not just modal-open) under the header.
2. Exercise the "Continue with Google" OAuth popup path specifically —
   COOP is the more likely culprit there, not COEP.
3. Re-check Convex websocket behavior post-authentication under
   isolation.
4. Re-run this whole check against whatever the actual deploy target
   is (Netlify) — `vite preview` headers are a dev/preview
   approximation; Netlify needs its own header config
   (`netlify.toml` / `_headers`) and that config was deliberately not
   touched by this spike.

## Alternatives considered

- **`unsafe-none` (status quo, no isolation)** — rejected as the
  long-term answer because it's the reason this spike exists:
  `SharedArrayBuffer` never becomes available, so rayon threading is a
  non-starter. Used here only as the control to validate the harness.
- **Playwright** — the task's suggested tool if available; not
  installed anywhere in the repo/system, and installing it would have
  been a new dependency the spike's guardrails explicitly forbid.
  Substituted with raw CDP over Node's built-in `WebSocket` (zero new
  packages) against the system's already-installed Chrome — this gave
  equivalent live-browser fidelity (real navigation, real console/network
  capture, real DOM interaction) without the dependency.

## Pre-mortem

It is six months later and this decision was a mistake. Most likely
reason: the OAuth popup path (never tested here) breaks under `COOP:
same-origin` in production — `window.opener` gets severed for the
Google consent popup, the popup can't hand the session back to the
opener, and "Continue with Google" silently stops working while
email/password sign-in keeps working fine, so it isn't caught until a
real user reports it. A secondary risk: Netlify's actual header
mechanism (`_headers` file / `netlify.toml`) behaves differently from
vite's `preview.headers` in some edge case (e.g., doesn't apply to a
cached/pre-rendered asset, or a CDN layer strips the header), so
production isolation silently doesn't take effect even though this
spike said it would.

Early warning sign to watch for: any support report of "Sign in with
Google" failing while email/password sign-in works, immediately after
a COOP/COEP header rollout — that's the popup-severing failure mode,
not a general Clerk outage, and would be missed by generic
uptime/error-rate monitoring that doesn't distinguish auth methods.

## Consequences

+ Rayon/SIMD-parallel Rust hot paths (blur, resize, denoise) become
  viable without an auth trade-off — the blocking assumption this spike
  existed to test is false.
+ `credentialless` gives a safer default than `require-corp` for
  future cross-origin embeds that don't ship CORP headers themselves.
- OAuth popup flow and full login round-trip remain unverified; landing
  the header change for real without closing those gaps risks the
  pre-mortem scenario above.
- Netlify-specific header delivery is untested; `vite preview` behavior
  is not proof of production behavior on the actual host.
- This branch is not merged and does not touch any prod config
  (`netlify.toml`, `app/vite.config.ts`'s `server`/`build` blocks) —
  the next session that acts on this ADR has to do that wiring from
  scratch, deliberately, not inherit it from this spike.
