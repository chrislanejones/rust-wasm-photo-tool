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

References are inputs whose ownership ends with the job. `completeJob` and
`failJob` clear all three reference slots, then use the same indexed ownership
helper as `discardFailedUpload` before deleting any distinct file. The release
and deletion are in one transaction. Saved archives, shares, AI input/output/mask
files and another job's reference slots all protect a shared file. A completed
job's output is attached before these checks, including when it equals a reference.
Repeated terminal callbacks do nothing. No user or job rows are deleted.

The signed provider webhook routes success to completion and failure/cancellation
to failure; a provider timeout reported as failure uses the same cleanup. A browser
wait timeout alone is not a terminal provider state and cannot safely release
inputs. Jobs without a terminal provider response retain references; adding a
server expiry/reconciliation policy is separate work. The sweep cron remains off.

The test-account planner and wipe include all three fields. The generic orphan
scanner already walks every field in every schema table.

If a later upload or dispatch fails, the browser offers each known uploaded ID
to `discardFailedUpload`. A job that already committed protects its references.
Cleanup failure never hides the original error; unknown uploads and failed
cleanup attempts still need the existing orphan sweep. Previously orphaned
reference files cannot be assigned to old jobs retroactively: their IDs were
never recorded.

Deployment adds three optional fields and three indexes to #367's five indexes.
They are installed on the next Convex push after merge. There is no backfill,
cron activation or live storage deletion in this change.

Verification: backend tests cover terminal cleanup through signed webhooks,
shared ownership, repeated callbacks, running jobs, rollback on a missing
reference, the three-reference limit, and references beyond row 2,000 in every
slot. Hook tests cover partial upload failure, dispatch rejection and successful
dispatch. The account-wipe schema audit and orphan-classification tests pass.


## Row 203 — design only: AI input/mask/output retention

Decide how long original inputs and masks remain useful and how the client
acknowledges durable import of an output before expiring it. Keep job audit
metadata independently of blobs. Implement bounded, resumable expiry of eligible
terminal jobs using shared-file index checks; protect running jobs and outputs
not yet safely consumed. Define handling for missed webhooks and abandoned jobs,
then test retries, races, missing files and cross-job ownership. Historical jobs
need an explicit migration/backfill policy. This PR does not implement that
retention policy, enable a sweep, or delete existing live files.
