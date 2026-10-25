// Commits per day for the Trail Log squares, with squash merges credited to
// the days their commits were written. gen-trail-data.mjs is the only caller;
// the logic lives here so node --test can drive it against a fixture repo.
//
// ── the problem ────────────────────────────────────────────────────────────
// The squares count `git log master` by author date. A squash merge is ONE
// commit, dated the moment it merges, so a night's work that merged the next
// afternoon drew on the merge day and left the night itself empty. Night 10-23
// read 0 on Friday and 9 extra on Saturday until it was patched by hand with a
// record-only merge (7a275ac0).
//
// ── the rule ───────────────────────────────────────────────────────────────
// A commit on master whose subject ends in `(#N)` (or `(#N, #M)`, one parent)
// is a squash of pull request N. With N's commits in the cache, the squash
// counts as those commits, each on its own author date. A commit that is
// already in master's history — merged in for real, or brought in by the
// record-only merge — is already one square, so the squash adds nothing for
// it, and a commit shared by two PRs counts once. With no cache entry the
// squash counts as one commit on its merge day, which is what it always did.
//
// The cache (src/data/squash-prs.json) is checked in so regenerating needs no
// network. Only PRs missing from it are asked for, through `gh`; when `gh` is
// absent or offline the generator says so and falls back as above.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

/** PR numbers a squash subject ends with: "x (#393, #397)" → [393, 397]. */
export function squashPrNumbers(subject) {
  const m = subject.match(/\(#(\d+(?:,\s*#\d+)*)\)\s*$/);
  return m ? m[1].split(",").map((s) => Number(s.trim().replace(/^#/, ""))) : [];
}

/** The calendar day of a UTC timestamp in a git-style offset ("-0400"). */
export function dayInOffset(iso, offset) {
  const m = /^([+-])(\d\d)(\d\d)$/.exec(offset || "+0000");
  const mins = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(Date.parse(iso) + mins * 60_000).toISOString().slice(0, 10);
}

const git = (root, args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

/**
 * Every commit reachable from `ref`, oldest first:
 * { oid, parents, day, offset, subject }. `day` is the author date in the
 * author's own offset, which is how the squares have always been dated.
 */
export function readLog(root, ref) {
  const out = git(root, [
    "log",
    ref,
    "--reverse",
    "--date=format:%Y-%m-%d %z",
    "--pretty=format:%H%x1f%P%x1f%ad%x1f%s%x1e",
  ]);
  return out
    .split("\x1e")
    .map((r) => r.replace(/^\n/, ""))
    .filter(Boolean)
    .map((r) => {
      const [oid, parents, date, subject] = r.split("\x1f");
      const [day, offset] = date.split(" ");
      return { oid, parents: parents ? parents.split(" ") : [], day, offset, subject };
    });
}

/** A squash commit: one parent and a `(#N)` suffix. Merge commits never are. */
export function squashOf(commit) {
  return commit.parents.length === 1 ? squashPrNumbers(commit.subject) : [];
}

/**
 * Per-day counts. `prs` is the cache's `prs` map ({ "393": { commits: [{ oid,
 * day }] } }). Returns { perDay, squashes } where each squash records how it
 * was counted: "credited" (its commits on their own days), "in-history" (all
 * of its commits are already in the log, so it adds 0) or "fallback" (no
 * cache entry: one commit on the merge day).
 */
export function countDays(commits, prs) {
  const perDay = {};
  const add = (day) => {
    perDay[day] = (perDay[day] || 0) + 1;
  };
  const seen = new Set(commits.map((c) => c.oid));
  const squashes = [];

  for (const c of commits) {
    const nums = squashOf(c);
    if (!nums.length) {
      add(c.day);
      continue;
    }
    const entries = nums.map((n) => prs[n]);
    if (entries.some((e) => !e || !Array.isArray(e.commits) || !e.commits.length)) {
      add(c.day);
      squashes.push({ oid: c.oid, prs: nums, day: c.day, status: "fallback", counted: 1 });
      continue;
    }
    let counted = 0;
    const days = {};
    for (const pc of entries.flatMap((e) => e.commits)) {
      if (seen.has(pc.oid)) continue; // already a square of its own
      seen.add(pc.oid);
      add(pc.day);
      days[pc.day] = (days[pc.day] || 0) + 1;
      counted++;
    }
    squashes.push({
      oid: c.oid,
      prs: nums,
      day: c.day,
      status: counted ? "credited" : "in-history",
      counted,
      days,
    });
  }
  return { perDay, squashes };
}

// ── the cache ──────────────────────────────────────────────────────────────

const ABOUT =
  "Commits of each squash-merged PR on master, for the Trail Log squares. " +
  "Written by marketing/scripts/gen-trail-data.mjs (see trail-days.mjs); read offline. " +
  "`day` is the author date in the author's own offset.";

export function readCache(path) {
  if (!existsSync(path)) return { prs: {} };
  const data = JSON.parse(readFileSync(path, "utf8"));
  return { prs: data.prs || {} };
}

/** One PR per line block, one commit per line: reviewable as a diff. */
export function writeCache(path, cache) {
  const nums = Object.keys(cache.prs).sort((a, b) => Number(a) - Number(b));
  const q = JSON.stringify;
  let s = `{\n  "about": ${q(ABOUT)},\n  "prs": {\n`;
  s += nums
    .map((n) => {
      const e = cache.prs[n];
      const lines = [];
      if (e.mergedAt) lines.push(`      "mergedAt": ${q(e.mergedAt)}`);
      if (e.note) lines.push(`      "note": ${q(e.note)}`);
      const commits = (e.commits || []).map(
        (c) => `        { "oid": ${q(c.oid)}, "authored": ${q(c.authored)}, "day": ${q(c.day)} }`,
      );
      lines.push(commits.length ? `      "commits": [\n${commits.join(",\n")}\n      ]` : `      "commits": []`);
      return `    ${q(n)}: {\n${lines.join(",\n")}\n    }`;
    })
    .join(",\n");
  s += `\n  }\n}\n`;
  writeFileSync(path, s);
}

const gh = (root, args) =>
  execFileSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });

/** `gh pr view --json commits` stops at 100 commits without saying so. */
export const GH_PR_VIEW_COMMIT_CAP = 100;
/** GitHub's REST list of a PR's commits stops at 250. */
export const GH_REST_COMMIT_CAP = 250;

/**
 * Ask `gh` for one PR. Resolves each commit's day from the local object when
 * git has it (exact, same as every other square), otherwise from GitHub's UTC
 * authoredDate shifted into the squash commit's own offset. Throws on a
 * network/auth failure; returns { note, commits: [] } for "not a PR".
 *
 * `gh pr view` silently truncates the commit list at 100 (cli/cli#13338), so a
 * PR that comes back with 100 is listed again through the REST endpoint, page
 * by page, which goes to GitHub's own limit of 250.
 */
export function ghFetchPr(root, number, offset) {
  let pr;
  let list;
  let note;
  try {
    pr = JSON.parse(gh(root, ["pr", "view", String(number), "--json", "number,state,mergedAt,commits"]));
    list = pr.commits.map((c) => ({ oid: c.oid, authoredDate: c.authoredDate }));
    if (list.length >= GH_PR_VIEW_COMMIT_CAP) {
      list = gh(root, [
        "api",
        "--paginate",
        `repos/{owner}/{repo}/pulls/${number}/commits?per_page=100`,
        "--jq",
        ".[] | {oid: .sha, authoredDate: .commit.author.date}",
      ])
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      if (list.length >= GH_REST_COMMIT_CAP) {
        note = `GitHub lists at most ${GH_REST_COMMIT_CAP} commits of a PR; this one may have more`;
      }
    }
  } catch (err) {
    const msg = String(err.stderr || err.message || err);
    if (/Could not resolve to a PullRequest|no pull requests found/i.test(msg)) {
      return { note: "not a pull request", commits: [] };
    }
    throw new Error(msg.trim().split("\n")[0] || "gh failed", { cause: err });
  }
  const commits = list.map((c) => {
    let day;
    try {
      day = git(root, ["show", "-s", "--date=format:%Y-%m-%d", "--format=%ad", `${c.oid}^{commit}`]).trim();
    } catch {
      day = dayInOffset(c.authoredDate, offset);
    }
    return { oid: c.oid, authored: c.authoredDate, day };
  });
  return note ? { mergedAt: pr.mergedAt || null, note, commits } : { mergedAt: pr.mergedAt || null, commits };
}

/**
 * Fill the cache for every squash in `commits` that has no entry (or every
 * squash, with `all`). `fetchPr(number, offset)` is injectable for tests.
 * Stops at the first failure that is not "not a PR" — offline, no gh, no auth
 * — and reports it; whatever was fetched before that is kept.
 */
export function fillCache(cache, commits, fetchPr, { all = false } = {}) {
  const want = [];
  for (const c of commits) {
    for (const n of squashOf(c)) {
      if (all || !cache.prs[n]) want.push({ n, offset: c.offset });
    }
  }
  let fetched = 0;
  for (const { n, offset } of want) {
    try {
      cache.prs[n] = fetchPr(n, offset);
      fetched++;
    } catch (err) {
      return { fetched, wanted: want.length, error: `#${n}: ${err.message}` };
    }
  }
  return { fetched, wanted: want.length, error: null };
}
