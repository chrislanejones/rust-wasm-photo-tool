// pnpm -C marketing test:scripts  (or: node --test marketing/scripts/trail-days.test.mjs)
//
// A throwaway git repo per test, with author dates pinned, so the Trail Log's
// day counting is checked against real `git log` output rather than a mock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  countDays,
  dayInOffset,
  fillCache,
  ghFetchPr,
  readCache,
  readLog,
  squashPrNumbers,
  writeCache,
} from "./trail-days.mjs";

const THU = "2026-10-22T12:00:00-04:00";
const FRI_NIGHT = "2026-10-23T22:15:00-04:00"; // 02:15Z on Saturday
const FRI_LATE = "2026-10-23T23:40:00-04:00";
const SAT = "2026-10-24T16:44:00-04:00";

function repo(t) {
  const dir = mkdtempSync(join(tmpdir(), "trail-days-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = (args, date) =>
    execFileSync("git", ["-c", "user.name=T", "-c", "user.email=t@example.invalid", ...args], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    }).trim();
  let n = 0;
  const commit = (subject, date) => {
    writeFileSync(join(dir, "f.txt"), String(n++));
    run(["add", "f.txt"], date);
    run(["commit", "-q", "-m", subject], date);
    return run(["rev-parse", "HEAD"], date);
  };
  run(["init", "-q", "-b", "master"], THU);
  return { dir, run, commit };
}

// The night: two commits on a PR branch, Friday evening, then a squash of
// them onto master on Saturday afternoon. The branch is left unmerged, as it
// is once GitHub squashes it and the branch is deleted.
function squashedNight(t) {
  const r = repo(t);
  r.commit("feat: base", THU);
  r.run(["checkout", "-q", "-b", "night"], FRI_NIGHT);
  const a = r.commit("feat: the night's first", FRI_NIGHT);
  const b = r.commit("fix: the night's second", FRI_LATE);
  r.run(["checkout", "-q", "master"], SAT);
  r.run(["merge", "-q", "--squash", "night"], SAT);
  r.run(["commit", "-q", "-m", "feat: what the night shipped (#7)"], SAT);
  return { ...r, a, b };
}

test("a squash dated Saturday whose commits are Friday counts for Friday", (t) => {
  const { dir, a, b } = squashedNight(t);
  const log = readLog(dir, "master");
  const prs = {
    7: {
      commits: [
        { oid: a, authored: "2026-10-24T02:15:00Z", day: "2026-10-23" },
        { oid: b, authored: "2026-10-24T03:40:00Z", day: "2026-10-23" },
      ],
    },
  };
  const { perDay, squashes } = countDays(log, prs);
  assert.deepEqual(perDay, { "2026-10-22": 1, "2026-10-23": 2 });
  assert.equal(squashes.length, 1);
  assert.equal(squashes[0].status, "credited");
  assert.equal(squashes[0].day, "2026-10-24");
});

test("offline with no cache entry: the squash counts on its merge day", (t) => {
  const { dir } = squashedNight(t);
  const log = readLog(dir, "master");
  const cache = { prs: {} };
  const fill = fillCache(cache, log, () => {
    throw new Error("error connecting to api.github.com");
  });
  assert.equal(fill.fetched, 0);
  assert.equal(fill.wanted, 1);
  assert.match(fill.error, /#7: error connecting/);
  assert.deepEqual(cache.prs, {}, "a failed fetch must not write an entry");

  const { perDay, squashes } = countDays(log, cache.prs);
  assert.deepEqual(perDay, { "2026-10-22": 1, "2026-10-24": 1 });
  assert.equal(squashes[0].status, "fallback");
});

test("a PR whose commits are already in master's history is not counted twice", (t) => {
  // The 10-23 hand patch: a record-only `merge -s ours` brings the night's
  // commits into master, and the squash commit is there as well.
  const r = squashedNight(t);
  r.run(["merge", "-q", "-s", "ours", "--no-edit", "night"], SAT);
  const log = readLog(r.dir, "master");
  const prs = {
    7: {
      commits: [
        { oid: r.a, day: "2026-10-23" },
        { oid: r.b, day: "2026-10-23" },
      ],
    },
  };
  const { perDay, squashes } = countDays(log, prs);
  // base · the two originals · the record-only merge commit. The squash adds 0.
  assert.deepEqual(perDay, { "2026-10-22": 1, "2026-10-23": 2, "2026-10-24": 1 });
  assert.equal(squashes[0].status, "in-history");
  assert.equal(squashes[0].counted, 0);
});

test("a commit listed by two PRs (stacked) counts once", (t) => {
  const { dir, a, b } = squashedNight(t);
  const log = readLog(dir, "master");
  const prs = {
    7: { commits: [{ oid: a, day: "2026-10-23" }] },
    8: { commits: [{ oid: a, day: "2026-10-23" }, { oid: b, day: "2026-10-23" }] },
  };
  // One squash that names both PRs, as master's "(#393, #397)" does.
  const both = log.map((c) =>
    c.subject.endsWith("(#7)") ? { ...c, subject: c.subject.replace("(#7)", "(#7, #8)") } : c,
  );
  assert.deepEqual(countDays(both, prs).perDay, { "2026-10-22": 1, "2026-10-23": 2 });
});

test("gh is asked only for missing PRs; days come from the local object, else the squash's offset", (t) => {
  const { dir, a } = squashedNight(t);
  const bin = join(dir, ".bin");
  mkdirSync(bin);
  // A stand-in `gh`: commit `a` exists locally, the second oid does not (a
  // force-pushed-away commit), so its day must come from the UTC timestamp.
  writeFileSync(
    join(bin, "gh"),
    `#!/bin/sh
cat <<'JSON'
{"number":7,"state":"MERGED","mergedAt":"2026-10-24T20:44:00Z","commits":[
 {"oid":"${a}","authoredDate":"2026-10-24T02:15:00Z"},
 {"oid":"${"f".repeat(40)}","authoredDate":"2026-10-24T03:59:00Z"}]}
JSON
`,
    { mode: 0o755 },
  );
  const PATH = process.env.PATH;
  process.env.PATH = `${bin}:${PATH}`;
  t.after(() => {
    process.env.PATH = PATH;
  });

  const log = readLog(dir, "master");
  const cache = { prs: {} };
  const fill = fillCache(cache, log, (n, offset) => ghFetchPr(dir, n, offset));
  assert.deepEqual(fill, { fetched: 1, wanted: 1, error: null });
  assert.deepEqual(
    cache.prs[7].commits.map((c) => c.day),
    ["2026-10-23", "2026-10-23"],
  );

  // Round-trips through the checked-in file, and a second run asks for nothing.
  const path = join(dir, "squash-prs.json");
  writeCache(path, cache);
  const again = readCache(path);
  assert.deepEqual(again.prs, JSON.parse(JSON.stringify(cache.prs)));
  assert.deepEqual(fillCache(again, log, () => assert.fail("no fetch expected")), {
    fetched: 0,
    wanted: 0,
    error: null,
  });
});

test("a PR that gh pr view cuts off at 100 commits is listed again through the REST pages", (t) => {
  const { dir } = squashedNight(t);
  const bin = join(dir, ".bin");
  mkdirSync(bin);
  const oid = (i) => i.toString(16).padStart(40, "0");
  const at = (i) => new Date(Date.parse("2026-10-23T14:00:00Z") + i * 60_000).toISOString().replace(".000", "");
  const view = { number: 7, state: "MERGED", mergedAt: "2026-10-24T20:44:00Z", commits: [] };
  for (let i = 1; i <= 100; i++) view.commits.push({ oid: oid(i), authoredDate: at(i) });
  writeFileSync(join(bin, "view.json"), JSON.stringify(view));
  const rest = [];
  for (let i = 1; i <= 130; i++) rest.push(JSON.stringify({ oid: oid(i), authoredDate: at(i) }));
  writeFileSync(join(bin, "rest.jsonl"), rest.join("\n") + "\n");
  writeFileSync(
    join(bin, "gh"),
    `#!/bin/sh
echo "$@" >> "${join(bin, "calls")}"
case "$1" in
  pr) cat "${join(bin, "view.json")}" ;;
  api) cat "${join(bin, "rest.jsonl")}" ;;
esac
`,
    { mode: 0o755 },
  );
  const PATH = process.env.PATH;
  process.env.PATH = `${bin}:${PATH}`;
  t.after(() => {
    process.env.PATH = PATH;
  });

  const entry = ghFetchPr(dir, 7, "-0400");
  assert.equal(entry.commits.length, 130);
  assert.equal(entry.note, undefined);
  const calls = readFileSync(join(bin, "calls"), "utf8");
  assert.match(calls, /^api --paginate repos\/\{owner\}\/\{repo\}\/pulls\/7\/commits/m);
});

test("squash subjects: the last parenthesis only, one or several PRs", () => {
  assert.deepEqual(squashPrNumbers("test: two flaky tests (#398)"), [398]);
  assert.deepEqual(squashPrNumbers("fix: leaders follow Align (#393, #397)"), [393, 397]);
  assert.deepEqual(squashPrNumbers("feat(presets): one click (#88) (#153)"), [153]);
  assert.deepEqual(squashPrNumbers("fix(#65): the sentinel band narrows (#63)"), [63]);
  assert.deepEqual(squashPrNumbers("Merge #397: callout leaders follow Align"), []);
  assert.deepEqual(squashPrNumbers("release: v9.37 — compare two screenshots"), []);
});

test("a UTC timestamp lands on the author's own calendar day", () => {
  assert.equal(dayInOffset("2026-10-24T00:01:08Z", "-0400"), "2026-10-23");
  assert.equal(dayInOffset("2026-10-24T04:00:00Z", "-0400"), "2026-10-24");
  assert.equal(dayInOffset("2026-10-23T22:30:00Z", "+0200"), "2026-10-24");
});
