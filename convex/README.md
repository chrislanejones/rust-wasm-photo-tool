# Convex backend

The optional cloud half of [Image Horse](../README.md). **The app must work with all of this switched off** — Convex and Clerk are enhancements, never requirements. Anything added here needs a working logged-out path.

Editing is local: pixels go through the Rust/WASM engine and originals live in the browser's IndexedDB. Convex holds accounts, billing, sharing and the AI job queue — not your images, unless you sign in and ask it to.

## Tables (`schema.ts`)

| Table | Holds |
| --- | --- |
| `users` | the Clerk-backed account row, including `tier` (`free` \| `pro` \| `team`) |
| `subscriptions` | Stripe subscription state, keyed back to a `users` id |
| `projects` | a saved document |
| `images` | image records belonging to a project |
| `layers` | per-image layer rows |
| `annotations` | shapes / text / pins attached to an image |
| `history` | persisted undo history |
| `shares` | share-link tokens and their expiry |

## Functions

- **`users.ts` / `auth.ts` / `auth.config.ts`** — identity. `auth.config.ts` declares the trusted Clerk **issuers**; Convex validates tokens by fetching Clerk's JWKS, so no signing key is ever stored here.
- **`subscriptions.ts` / `stripe.ts`** — billing. Stripe is called over **raw REST, no SDK**; `stripe.ts` creates Checkout and Customer Portal sessions.
- **`ai.ts` / `aiJobs.ts` / `testReplicate.ts`** — the Replicate job queue: dispatch, poll, and the job rows the client subscribes to.
- **`images.ts` / `layers.ts` / `annotations.ts` / `history.ts` / `textHistory.ts` / `photoEdits.ts` / `projects.ts`** — document persistence.
- **`shares.ts`** — share links.
- **`crons.ts`** — scheduled cleanup.
- **`http.ts` / `router.ts`** — the two webhook endpoints: `/replicate-webhook` and `/stripe-webhook`. Both verify signatures before touching data.

## Working on this

Read **`_generated/ai/guidelines.md` first** — it overrides general Convex knowledge with the rules this deployment actually follows.

```bash
npx convex dev          # watch + push to your dev deployment
npx convex dev --once   # push once
npx convex codegen      # regenerate _generated/ (CI checks this for drift)
```

⚠️ **Never run `npx convex env list` — it prints every secret in the deployment to your terminal.** Use `npx convex env get <NAME>` for a single value. This has already caused one credential exposure.

⚠️ **`convex deploy` targets a different deployment than the one production talks to.** Confirm which deployment you are pointed at before running it; the prod app and local dev do not share a Clerk instance either, so "signed in locally" proves nothing about prod.

CI runs `convex codegen` plus a `_generated` drift check, but only when the `CONVEX_DEPLOY_KEY` repo secret is set — use a preview/CI key, never prod. Without it the job prints "skipped" and stays green. See [docs/CI.md](../docs/CI.md).
