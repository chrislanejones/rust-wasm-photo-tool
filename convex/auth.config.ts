// convex/auth.config.ts
//
// WHICH CLERK INSTANCES THIS DEPLOYMENT TRUSTS.
//
// Two are listed because two are in use, and listing only one is what broke
// share links on the deployed app (2026-07-27). Measured, not guessed:
//
//   local dev      Clerk `grateful-dingo-89`  → token iss grateful-dingo-89 ✓ accepted
//   Netlify (live) Clerk `amazed-akita-72`    → token iss amazed-akita-72   ✗ REJECTED
//
// Clerk's `isSignedIn` stays true either way, so the app looked signed in while
// `useConvexAuth().isAuthenticated` never flipped. Every Convex-backed feature
// then behaved as signed-out for a signed-in user — share links said "Sign in
// to create share links", and the same silence covers recent texts, preference
// sync, edit persistence and the tier lookup. (See `useRecentTexts`, which
// documented this exact failure mode before it happened.)
//
// A provider entry only says "tokens with this issuer are acceptable", so
// adding one is additive: it cannot invalidate the sessions already working.
//
// THIS IS THE STOPGAP, NOT THE FIX. The real problem is that the live site is
// pointed at the DEVELOPMENT Convex deployment (brave-ant-608) and a second
// development Clerk instance — Clerk itself warns "loaded with development
// keys" in the production console. The production deployment
// (pastel-alligator-180) is not being used by the deployed app at all.
// Consolidating onto one production instance is Chris's call; see
// docs/share-links-auth-mismatch.md.
export default {
  providers: [
    {
      // Local development (app/.env.local)
      domain: "https://grateful-dingo-89.clerk.accounts.dev",
      applicationID: "convex",
    },
    {
      // The instance the deployed Netlify build actually signs users in with
      domain: "https://amazed-akita-72.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
