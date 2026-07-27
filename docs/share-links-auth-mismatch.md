# Share links say "Sign in" to signed-in users

**Found** 2026-07-27, from Chris's report: *"logged in I just see this — Sign in
to create share links."*

**Status: root cause identified with evidence. Stopgap committed. One decision
is Chris's and is NOT made here.**

---

## What is actually wrong

The live site signs you in with one Clerk instance and asks a Convex deployment
that only trusts a *different* Clerk instance.

| | value | how it was measured |
| --- | --- | --- |
| Clerk instance, local dev | `grateful-dingo-89.clerk.accounts.dev` | `window.Clerk.frontendApi` on `localhost:5173` |
| Clerk instance, **live site** | `amazed-akita-72.clerk.accounts.dev` | `window.Clerk.frontendApi` on `rust-wasm-photo-tool.netlify.app` |
| Issuer `convex/auth.config.ts` trusted | `grateful-dingo-89` **only** | the file, before this change |
| Convex deployment the live site talks to | `brave-ant-608.convex.cloud` — the **development** one | grepped the deployed JS bundle |
| Convex **production** deployment | `pastel-alligator-180.convex.cloud` | `convex status` — **not used by the deployed app at all** |

So on the live site: Clerk mints a valid `convex` token whose `iss` is
`amazed-akita-72`; the Convex deployment accepts only `grateful-dingo-89`;
the token is rejected; `useConvexAuth().isAuthenticated` never becomes true.

Clerk's own `isSignedIn` stays true throughout. That is why the app looks
signed in while every Convex-backed feature behaves as signed out.

`app/src/hooks/useRecentTexts.ts:23` documented this exact failure mode before
it happened:

> `useConvexAuth.isAuthenticated` is true only after Convex completes the JWT
> handshake — unlike Clerk's `isSignedIn` which stays true even when the Convex
> auth provider rejects the token (e.g. dev keys vs prod deployment).

## It is not only share links

Every consumer of `useConvexAuth()` fails the same silent way for a signed-in
user on the live site:

- `useShare` — share links (the reported symptom)
- `useEditPersistence` — cloud edit persistence
- `lib/preferences` — preference sync
- `useRecentTexts` — recent texts
- `useStoreUser` — the user record, **and therefore the tier lookup**

That last one is worth flagging: this is the same *shape* as the v7.50 paid-tier
bug (Convex `free|pro|team` vs UI `demo|loggedIn|paid`, no translation layer, no
test). If a paid account signs in on the live site today, Convex never
authenticates it, so it cannot read as paid.

**Not verified**, because it needs a paid account on the live site: whether
paid users are currently being served free-tier caps in production. Worth
checking before anything else. → **OPEN-1**

## What was measured, so nobody re-derives it

Verified locally at `localhost:5173`, signed in as Chris:

- `Clerk.session.getToken({ template: "convex" })` → **issued**, with
  `iss: https://grateful-dingo-89.clerk.accounts.dev`, `aud: convex` — matching
  `auth.config.ts` exactly. The JWT template is fine.
- Clicking **Share link** produced a real link:
  `http://localhost:5173/?v=a33cc22badc64286a2c90b9cc9e9a51e`.

**Share links work correctly in local development.** The failure is purely the
environment mismatch above. The prod console also warns, unprompted:
*"Clerk has been loaded with development keys."*

## What was changed (stopgap)

1. `convex/auth.config.ts` now lists **both** Clerk instances as providers.
   A provider entry only declares "tokens with this issuer are acceptable", so
   adding one is additive and cannot invalidate sessions that already work.

2. `useShare` distinguishes three states instead of collapsing them into
   "signed out": `connecting` (handshake in flight), `signed-out`, and
   `backend-rejected` (Clerk session present, Convex refused). `ShareButton`
   reports each honestly, so a signed-in user is never told to sign in.
   The Clerk check reads the global rather than `useAuth()` deliberately —
   `ShareButton` renders in demo mode, where no `ClerkProvider` is mounted and
   Clerk's hooks would throw. Demo mode is a project invariant.

### The stopgap is not live until Convex is deployed

The auth config only takes effect once pushed to the deployment the live site
uses (`brave-ant-608`). **Not run here** — it changes auth behaviour for the
backend production depends on, and that is a morning decision:

```bash
npx convex deploy        # pushes convex/ incl. auth.config.ts
```

## The decision this does NOT make → **OPEN-2**

The live site runs on a **development** Convex deployment and **development**
Clerk keys, while a production Convex deployment sits unused. Accepting two
issuers makes the symptom go away; it does not make that right.

The options, not chosen here:

- **A — Point the live site at production.** Set Netlify's `VITE_CONVEX_URL` to
  `pastel-alligator-180` and `VITE_CLERK_PUBLISHABLE_KEY` to a production Clerk
  instance. Correct end state. Costs: a Clerk production instance needs a
  domain, and existing dev-instance users/data do not come with it.
- **B — Consolidate on one dev instance.** Set Netlify's Clerk key to
  `grateful-dingo-89` so live and local match. Cheapest, keeps the live site on
  development keys, which Clerk explicitly warns against and rate-limits.
- **C — Keep both issuers trusted (what is committed).** Unblocks share links
  now. Leaves two instances and two user pools indefinitely.

C is a stopgap chosen so the reported bug stops biting; it is deliberately the
least opinionated option. A is the real fix.

Related: the JWT signing key is still pending rotation after being exposed by
`convex env list` on 2026-06-26 — never run that command again, it dumps every
secret. Whichever option is taken, rotate as part of it.
