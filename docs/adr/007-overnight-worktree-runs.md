# ADR-007: Unattended agent runs happen on disposable worktrees in auto mode
Date: 2026-07-02 (backfilled)   Status: Accepted (confirmed 2026-07-09)
Verified: this is not a hypothetical — this very audit session ran
under the described setup (dedicated worktree at `~/ai-repo/ih-adr`,
task branch `docs/adr-status-audit`, off master). `~/ai-repo/` holds
multiple other task worktrees (ih-tiles, ih-e2e, ih-spike) at the time
of this audit (2026-07-09), consistent with "every unattended run gets
one." Confirmed Accepted by Chris 2026-07-09.

## Context
Overnight agent sessions need to run without permission prompts, on a
WSL host holding real user data, where a documented failure mode is
catastrophic filesystem damage from unguarded autonomous runs.

## Decision
Every unattended run: dedicated git worktree on a task branch created
by a human; --permission-mode auto; settings.json deny rules for rm/
sudo/force-push/.env active in all modes; one commit per task behind
gates; SESSION_LOG.md maintained; nothing merges without human review.
Bypass mode only ever inside containers, never on the host.

## Consequences
+ Worst case is a deleted branch; main and $HOME are never exposed.
+ Per-task commits make partial nights salvageable.
- Worktree ceremony per run; ignored files don't materialize in
  worktrees (run docs live outside the repo).
- Auto-mode escalation can end a run early (by design).

## Alternatives rejected
--dangerously-skip-permissions on the host — documented disasters,
including on WSL2 specifically; prompting modes — defeat the purpose.

## Pre-mortem
Mistake most likely because review discipline eroded and "skim and
merge" became rubber-stamping.
Early warning: merging a night run without running QC sections 1-2.
