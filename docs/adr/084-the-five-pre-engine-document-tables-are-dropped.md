# ADR-084: The five pre-engine document tables are dropped
Date: 2026-10-05   Status: draft   Relates to: ADR-083

## Context

`projects`, `images`, `layers`, `annotations` and `history` are the document
model from before the Rust engine owned pixels. #236 found no callers in the
app, in `convex/` (including internal functions, crons and http), scripts, e2e,
tests, marketing or CI. Row counts: 0 in all five on dev `brave-ant-608`
(re-checked 10-05) and 0 on prod `pastel-alligator-180` (recorded in #236).
They were still listed on /architecture and counted in the ⌘K "6 tables"
hint.

## Decision

Delete the five function files and remove the five tables from
`convex/schema.ts`. Nine tables remain. Regenerate `_generated/api.d.ts`;
/architecture and the ⌘K hint now say 9. The test-account wipe (#241,
`convex/testAccountWipe.ts`) is changed in this branch to match:
`WIPE_ORDER` is `share_views, photo_edits, shares, ai_jobs`, and `FILE_FIELDS`
no longer lists `images`.

## Consequences

+ The schema lists only the tables in use, so nobody builds on the dead model
  by accident. The orphan sweep (ADR-083) and the wipe also scan fewer tables.
- **Two deployments, two routes.** Merging to master deploys prod
  automatically (CI's `convex-deploy`). The live app runs on dev, which needs
  `CONVEX_DEPLOYMENT=dev:brave-ant-608 pnpm exec convex dev --once` by hand.
  Order does not matter (no client calls these), but if the dev step is
  forgotten, the two deployments' schemas drift apart.
- `images` had a `storageId` field. The sweep only scans tables in the schema,
  so any row that showed up there later would not count as a reference.
  It is safe today only because all five tables are empty on both deployments.
- One-way in practice. Bringing back the old model means writing it again.

## Alternatives rejected

1. **Leave them in the schema, unused.** Costs nothing to run, but it keeps
   telling readers and the architecture page that a sixth model exists.
2. **Widen-migrate-narrow.** That is for tables with data. These have none to
   migrate.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the dev
step was skipped. Dev `brave-ant-608` kept the old schema and functions while
prod and the repo moved on, and the next schema change on dev failed or
behaved differently from prod, which cost a debugging session.
Early warning sign: `projects:*` or `images:*` still listed in the dev
deployment's function list after this ships.
