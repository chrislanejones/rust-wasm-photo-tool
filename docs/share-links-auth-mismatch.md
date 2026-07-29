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

---

# 2026-07-29 — OPEN-1 verified: auth is FIXED in production, tier is STILL BROKEN

Diagnosis only. Nothing was changed, and `npx convex deploy` was **not** run.

## VERIFIED: the deployed backend trusts both issuers

The v7.56 config did reach production. It was measured against the running
deployment rather than inferred from the repo, using a probe that needs no
credentials: send a structurally valid but unsigned JWT and read *which* failure
comes back. An issuer the deployment does not know fails differently from one it
knows but cannot verify.

| issuer in the probe token | `brave-ant-608` responds |
| --- | --- |
| `amazed-akita-72` (what the live site signs in with) | `Unauthenticated` — "Could not verify OIDC token claim" |
| `grateful-dingo-89` (local dev) | `Unauthenticated` — "Could not verify OIDC token claim" |
| a deliberately unconfigured issuer | `NoAuthProvider` — and it **enumerates the configured providers** |

That third response is the evidence, quoted verbatim:

> No auth provider found matching the given token. Check that your JWT's issuer
> and audience match one of your configured providers:
> `[OIDC(domain=https://grateful-dingo-89.clerk.accounts.dev, app_id=convex),`
> `OIDC(domain=https://amazed-akita-72.clerk.accounts.dev, app_id=convex)]`

Both issuers are live on `brave-ant-608`, which the current production bundle
still points at (re-measured today from the deployed JS). So the reported
symptom — share links telling a signed-in user to sign in — is **fixed in
production**. `useConvexAuth().isAuthenticated` can now become true there, and
with it `useShare`, `useEditPersistence`, `lib/preferences` and `useRecentTexts`.

## STILL BROKEN: a paid account reads as free on the live site

The auth chain now completes, so `useStoreUser` → `users.upsert` → `useRealTier`
→ `userModeForTier` can all run in production. The tier it finds is still wrong,
for a reason that has nothing to do with issuers.

`users.upsert` keys the row on `identity.subject` — the **Clerk user id**, which
is per-instance. The same human signing in through two Clerk instances is two
different subjects, and therefore two different Convex user rows.

The `users` table on `brave-ant-608` today (read-only; identifiers truncated and
addresses omitted — this repository is public):

| row | Clerk subject | tier | created | last updated |
| --- | --- | --- | --- | --- |
| A | `user_3BhLik…` | **pro** | 2026-06-26 | 2026-07-27 |
| B | `user_36c1Kt…` | **free** | 2026-07-26 | 2026-07-27 |
| C | `user_3H5RXP…` | free | 2026-07-26 | 2026-07-26 |

Rows A and B are the **same person, same email address**, under two Clerk
instances. A carries the `pro` grant and the synced `settings` blob (written
from local dev, where auth has always worked). B is the identity the live site
authenticates as, and it is `free`.

Both A and B were last written on 2026-07-27 — the day the issuer fix landed —
which is itself evidence the fix works: B could only have been upserted from a
session Convex actually authenticated.

**So the answer to OPEN-1 is yes: paid accounts are served free-tier caps in
production.** Gallery 24 instead of 100, and the Replicate AI tools off — the
paid headline. Not because the tier lookup fails, but because it succeeds
against the wrong row. The server is enforcing that row honestly; there is no
gating bug left to find in the client (v7.50 wired `useRealTier` correctly, and
that wiring is what makes the failure visible rather than silent).

This confirms rather than contradicts the earlier note that a paid tier "does
not cross instances" — it now has data behind it.

## Also found: the real production deployment trusts nobody

The same probe against `pastel-alligator-180` (the unused production
deployment) returns the short form — `"No auth provider found matching the given
token"` with **no provider list at all**, where `brave-ant-608` enumerates two.
Read as: production has no auth providers configured.

This is a live trap for **Option A** below. Repointing Netlify's
`VITE_CONVEX_URL` at production without first deploying `convex/auth.config.ts`
there would take the app from "authenticated as the wrong user row" to "not
authenticated at all" — a strictly worse outcome, and one that would look like
the original bug coming back.

## What this changes about the options

Option C (what shipped) is now confirmed working for its stated purpose and
nothing more. The tier problem is **not** solved by trusting both issuers, and
will not be solved by any amount of issuer configuration:

- **A — point the live site at production.** Still the real fix, and now known
  to require deploying the auth config to `pastel-alligator-180` *first*. Also
  needs a decision about the two existing user rows: row A's `pro` grant and
  settings do not follow the user to a new instance.
- **B — consolidate on `grateful-dingo-89`.** This is the only option that fixes
  the tier symptom immediately, because the live site would then sign in as
  subject `user_3BhLik…` — the row that already holds `pro`. It keeps the site
  on development keys, which Clerk warns against.
- **A merge step, under either.** Whatever is chosen, someone has to decide what
  happens to the duplicate rows: re-grant the tier on the surviving identity, or
  migrate row A's tier and settings onto it. Nothing here does that — it writes
  to user data and it is Chris's call.

## How to re-check without credentials

```bash
# Which issuers does a deployment actually trust? Unsigned probe token; the
# error text names the configured providers. No credentials, no writes.
curl -s -X POST https://<deployment>.convex.cloud/api/query \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $(printf '%s.%s.%s' \
      "$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64 -w0 | tr '+/' '-_' | tr -d '=')" \
      "$(echo -n '{"iss":"https://unconfigured.example.com","aud":"convex","sub":"probe","exp":9999999999}' | base64 -w0 | tr '+/' '-_' | tr -d '=')" \
      "c2ln")" \
  -d '{"path":"users:me","args":{},"format":"json"}'
```

Still not verified, because it needs a real signed-in session on the live site:
that a signed-in user now sees share links working end to end. The backend half
is proven; the browser half needs Chris's credentials.

---

# 2026-07-30 — STRIPE LINKAGE: option B is safe, and the question is largely moot

Diagnostic only. Nothing was written, no Stripe call was made, no user row was
touched, `npx convex deploy` was not run. All four questions read off
`brave-ant-608` — the deployment the live site actually uses — and the source.

## Verdict

**Option B is safe. No row migration is needed, because there is nothing to
migrate: no subscription has ever existed.**

## 1. Does a Stripe customer record exist? — **No. Zero.**

The `subscriptions` table on `brave-ant-608` is **empty**. Not "one pointing at
the wrong row" — none at all. Nobody has ever completed a checkout against the
deployment the live site talks to.

That alone makes the linkage question moot: there is no `stripeCustomerId`
anywhere to be attached to the wrong identity.

**It also answers the open question about how you subscribed: you didn't.** The
`pro` tier on the dev-subject row is a **manual grant**, not a purchase. Two
mechanisms can produce it and neither involves Stripe:

- `users.devGrantTier` — an `internalMutation`, looks the user up **by email**
  and patches `tier`.
- `users.setMyTier` — the Super User pane's "Apply". Public, but gated on the
  `ADMIN_EMAIL` Convex env var and throws for everyone else *and* when the env
  var is unset. (Checked specifically, since a self-serve tier setter would be a
  far more urgent finding than the one being investigated. It is properly
  gated.)

So the pro row is a grant made by email or by admin action, which is why it
survived on the dev-subject row while the production-subject row stayed free.

## 2. Which row holds the `stripeCustomerId`? — **Neither; it is not on the user row at all**

Worth correcting the premise: `stripeCustomerId` is not a field on `users`. It
lives on the separate `subscriptions` table, keyed by `userId: v.id("users")`:

```
subscriptions: { userId, stripeCustomerId, stripeSubId, plan, status, ... }
  .index("by_userId") .index("by_stripeCustomerId") .index("by_stripeSubId")
```

So the linkage is a row reference, not a column on the identity — and with the
table empty, there is no reference in either direction.

## 3. What does the webhook resolve on? — **A Convex `Id<"users">` stamped at checkout**

This was the crux, and the answer is the good one.

`convex/http.ts` `/stripe-webhook` reads `obj.metadata.userId` and passes it
straight to `subscriptions.fulfill`. It does **not** look up the user by
`stripeCustomerId`, and it does **not** use a raw `identity.subject`.

That `metadata.userId` is stamped in `convex/stripe.ts`:

```
const userId = await ctx.runMutation(api.users.upsert, {});   // from the LIVE session
"metadata[userId]": String(userId),
"subscription_data[metadata][userId]": String(userId),
```

`users.upsert` resolves the row from `ctx.auth.getUserIdentity()` at checkout
time. So the subscription is bound to **whichever Convex row the person is
signed in as when they click Upgrade**.

**This is why option B fixes tomorrow as well as today.** After repointing
prod's Clerk key at `grateful-dingo-89`, a prod session resolves to the
dev-subject row — the one that already holds `pro` — so a future checkout stamps
*that* row's id and the webhook writes there. The failure you were worried about
(a later checkout re-orphaning the tier) requires prod to keep authenticating as
the production subject, which is exactly what option B stops.

The opposite design — resolving by `stripeCustomerId` → user — would have been
the dangerous one, because an existing customer record would pin future payments
to whichever row it was first attached to. That design is not in use.

## 4. Does Plan & Billing read the row the webhook writes? — **Yes**

No third instance of the pattern here. `subscriptions.fulfill` writes both
sides:

```
await ctx.db.insert/patch("subscriptions", { userId, ... })
const tier = sub.status === "active" ? sub.plan : "free";
await ctx.db.patch(userId, { tier, updatedAt: Date.now() });   // ← the users row
```

and the UI reads exactly that:

- `useRealTier` → `api.users.me` → `users.tier`
- `SubscriptionButton` → `api.users.me` **and** `api.subscriptions.getByUser`

Both resolve through the authenticated identity, so they read whatever row the
session maps to — the same row `fulfill` patched. The tier the panel shows and
the tier the server enforces come from one field.

## What is still not verified, and by whom

- **The unused production deployment (`pastel-alligator-180`) was not read.**
  The Convex MCP marks it `readOnly`, which permits `tables`/`functionSpec` but
  refuses `data`, so "no subscriptions" is established for `brave-ant-608` only.
  Given the live site has never pointed at production and production trusts no
  auth issuer at all (see the 2026-07-29 section), a subscription existing there
  is close to impossible — but it is inference, not a reading.
- **The Clerk user count in `amazed-akita-72`** — yours to check, thirty seconds
  in the dashboard, and it is the one input this verdict does not cover.
  Everything above says option B is safe *for billing*; it says nothing about
  accounts. Switching instances does not migrate Clerk users, so if real people
  have signed up against `amazed-akita-72`, they lose access on the day of the
  switch regardless of the Stripe answer being clean.

## Revised summary of the options

- **B — consolidate on `grateful-dingo-89`.** Safe from the billing side, and it
  is the only option that fixes the paid-tier symptom immediately (prod would
  authenticate as the row that already holds `pro`). Gated solely on the Clerk
  user-count question above.
- **A — point the live site at production.** Unchanged, and still carries the
  trap recorded on 2026-07-29: `pastel-alligator-180` has **no auth providers
  configured**, so repointing without deploying `auth.config.ts` there first
  goes from "wrong user row" to "not authenticated at all".
- **Row migration** — **not needed**. There is no subscription to move, and the
  `pro` tier is a manual grant that can simply be re-applied to whichever row
  survives, by email, with `devGrantTier`.
