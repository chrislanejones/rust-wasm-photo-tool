#!/usr/bin/env node
// pnpm wipe:test-account --deployment <name> [--apply] [--batch N]
//
// Needs Node >= 22.18 (imports convex/testAccount.ts directly; Node strips the
// types). Verified on Node 25.2.1.
//
// Deletes the retention TEST account's stored files together with the rows
// that own them. DRY RUN BY DEFAULT: without --apply it only reads, and prints
// per-table row counts, the file count and the bytes those files hold.
//
// Rules, all enforced on the SERVER as well (convex/testAccount.ts), because
// an internal function can be called with `convex run` by anyone who has the
// CLI logged in, script or no script:
//   - one hardcoded email, TEST_ACCOUNT_EMAIL; anything else is refused
//   - more than one users row with that email → refused, with the ids
//   - TEST_CLERK_ID, when set, must match the row's clerkId; --apply refuses
//     while it is unset
//   - a file that another account's row also references → refused
//   - each file is deleted together with its row through the table's delete
//     helper, in batches of --batch rows per mutation
//
// The deployment is REQUIRED and named explicitly. There is no default: the
// live app runs on a deployment called "dev", and a default would sooner or
// later point at it by accident. `--codegen disable` keeps a run from
// rewriting convex/_generated/.
//
// The server functions are internal, so they must be DEPLOYED before this can
// run against a deployment — this script never pushes code.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Node strips the types; this is the single source of the allowlist.
import { TEST_ACCOUNT_EMAIL, TEST_CLERK_ID, WIPE_ORDER, KEPT_TABLES } from "../convex/testAccount.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BATCH = 20;

function fail(message) {
  console.error(`wipe-test-account: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { deployment: null, apply: false, batch: DEFAULT_BATCH, email: TEST_ACCOUNT_EMAIL };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--deployment") out.deployment = argv[++i] ?? null;
    else if (a === "--batch") out.batch = Number(argv[++i]);
    else if (a === "--email") out.email = argv[++i] ?? "";
    else if (a === "--help" || a === "-h") {
      console.log("usage: pnpm wipe:test-account --deployment <name> [--apply] [--batch N]");
      process.exit(0);
    } else fail(`unknown argument ${JSON.stringify(a)}`);
  }
  return out;
}

function convexRun(deployment, fn, args) {
  const cmd = [
    "exec", "convex", "run",
    "--deployment", deployment,
    "--codegen", "disable",
    "--typecheck", "disable",
    fn, JSON.stringify(args),
  ];
  let stdout;
  try {
    stdout = execFileSync("pnpm", cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  } catch (err) {
    fail(
      `\`pnpm ${cmd.join(" ")}\` failed (exit ${err.status}). ` +
        `If the error says the function does not exist, the internal functions are not deployed to ${deployment} yet.`,
    );
  }
  try {
    return JSON.parse(stdout);
  } catch {
    fail(`could not parse the result of ${fn} as JSON:\n${stdout}`);
  }
}

function mib(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function printPlan(p) {
  const rows = WIPE_ORDER.map((t) => [t, p.rows[t], "delete"]);
  const kept = KEPT_TABLES.map((t) => [t, p.kept[t], "keep"]);
  const w = Math.max(...[...rows, ...kept].map(([t]) => t.length));
  console.log(`account   ${p.email}  users._id=${p.userId}  clerkId=${p.clerkId}`);
  console.log(`clerkId   ${p.clerkIdPinned ? "pinned (TEST_CLERK_ID matches)" : "NOT pinned (TEST_CLERK_ID is empty; --apply will refuse)"}`);
  console.log("");
  console.log(`${"table".padEnd(w)}  rows  action`);
  for (const [t, n, action] of [...rows, ...kept]) console.log(`${t.padEnd(w)}  ${String(n).padStart(4)}  ${action}`);
  console.log("");
  console.log(`rows to delete            ${p.totalRows}`);
  console.log(`files to delete           ${p.files}`);
  console.log(`bytes in those files      ${p.bytes} (${mib(p.bytes)})`);
  console.log(`files already missing     ${p.missingFiles}`);
  console.log(`shared with other accts   ${p.sharedWithOtherAccounts}`);
  console.log(`truncated                 ${p.truncated}`);
}

const args = parseArgs(process.argv.slice(2));
if (!args.deployment) fail("--deployment <name> is required (e.g. --deployment brave-ant-608). There is no default.");
if (args.email !== TEST_ACCOUNT_EMAIL) fail(`refused: only ${TEST_ACCOUNT_EMAIL} can be wiped, not ${JSON.stringify(args.email)}`);
if (!Number.isInteger(args.batch) || args.batch < 1 || args.batch > 50) fail("--batch must be an integer 1..50");

console.log(`${args.apply ? "APPLY" : "DRY RUN"} against deployment ${args.deployment}`);
console.log(`TEST_CLERK_ID in this checkout: ${TEST_CLERK_ID === "" ? "(empty)" : TEST_CLERK_ID}\n`);

const plan = convexRun(args.deployment, "testAccountWipe:plan", { email: TEST_ACCOUNT_EMAIL });
if (!plan.ok) {
  console.log(`no plan: ${plan.reason}`);
  process.exit(plan.matched === 0 ? 0 : 1);
}
printPlan(plan);

if (!args.apply) {
  console.log("\nDry run only. Nothing was deleted. Re-run with --apply to delete.");
  process.exit(0);
}

if (!plan.clerkIdPinned) fail("refused: TEST_CLERK_ID is not set (see convex/testAccount.ts)");
if (plan.truncated) fail("refused: the plan was truncated; this tool is sized for a test account");
if (plan.sharedWithOtherAccounts > 0) fail("refused: some files are also referenced by another account");
if (plan.totalRows === 0) {
  console.log("\nNothing to delete.");
  process.exit(0);
}

const maxBatches = Math.ceil(plan.totalRows / args.batch) + 10;
const total = { rows: 0, files: 0, bytes: 0 };
for (let i = 1; ; i++) {
  if (i > maxBatches) fail(`stopped after ${maxBatches} batches without finishing; re-run the dry run to see what is left`);
  const r = convexRun(args.deployment, "testAccountWipe:applyBatch", { email: TEST_ACCOUNT_EMAIL, batchSize: args.batch });
  total.rows += r.rows;
  total.files += r.files;
  total.bytes += r.bytes;
  console.log(`batch ${i}: ${r.rows} rows, ${r.files} files, ${mib(r.bytes)}${r.done ? " — done" : ""}`);
  if (r.done) break;
}

console.log(`\ndeleted ${total.rows} rows, ${total.files} files, ${total.bytes} bytes (${mib(total.bytes)})`);
const after = convexRun(args.deployment, "testAccountWipe:plan", { email: TEST_ACCOUNT_EMAIL });
if (!after.ok || after.totalRows !== 0 || after.files !== 0) {
  fail(`verification FAILED: after the wipe the plan reads ${JSON.stringify(after)}`);
}
console.log("verified: the test account now owns 0 wipeable rows and 0 files.");
