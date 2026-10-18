# Create AI Image reference storage

Branch review, 2026-10-17. Depends on #367; not deployed.

`startGenerateJob` used to resolve reference uploads to URLs without storing
their IDs. No row owned those files, so cleanup could delete a running job's
input, and account cleanup could never find it.

The job now owns up to three reference files through optional scalar fields
`referenceStorageId1`–`referenceStorageId3`. Each has an equality index, and
`discardFailedUpload` checks all three inside its deletion transaction. Scalar
slots match the existing three-reference limit and allow membership lookups
without bounded scans. More than three references are rejected by the internal
start mutation before usage is charged. Missing files roll back the entire
transaction, including usage and the job insertion.

References follow the existing AI input/mask/output retention policy: they stay
attached to running, completed and failed jobs. This preserves job history;
it does not introduce automatic job expiry. The test-account planner and wipe
include all three fields. The generic orphan scanner already walks every field
in every schema table, so it sees them without another special case.

If a later upload or dispatch fails, the browser offers each known uploaded ID
to `discardFailedUpload`. A job that already committed protects its references.
Cleanup failure never hides the original error; unknown uploads and failed
cleanup attempts still need the existing orphan sweep. Previously orphaned
reference files cannot be assigned to old jobs retroactively: their IDs were
never recorded.

Deployment adds three optional fields and three indexes to #367's five indexes.
They are installed on the next Convex push after merge. There is no backfill,
cron activation or live storage deletion in this change.

Verification: backend tests cover running/done/failed jobs, rollback on a missing
reference, the three-reference limit, and references beyond row 2,000 in every
slot. Hook tests cover partial upload failure, dispatch rejection and successful
dispatch. The account-wipe schema audit and orphan-classification tests pass.
