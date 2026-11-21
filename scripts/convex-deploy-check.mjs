#!/usr/bin/env node
// Is every Convex module in this repo actually live on the deployment?
//
// WHY THIS EXISTS. `convex codegen` — the only Convex step CI had until now —
// typechecks the functions and regenerates `convex/_generated`. It does not
// push anything. So the repo could hold a function, CI could go green on it,
// the client could ship a call to it, and production could have never heard of
// it. That is not hypothetical: #121 shipped a client calling
// `userColors:listUserColors`, the function was never deployed, and every
// signed-in user got a blank screen.
//
// At the time this script was written, prod was missing FIVE modules that the
// repo has had for weeks — `shares`, `userColors`, `router`, `crons` and
// `testReplicate` — and the app calls two of them. Nothing anywhere noticed.
//
// Run it in two places, for two different questions:
//   --expect-deployment <url>   before deploying: am I pointed at the right
//                               deployment at all?
//   (no flag)                   after deploying: did the modules land?
//
// `--prod` aims either question at the project's production deployment instead
// of whatever the ambient key selects. Useful locally, where the default is
// dev: running it both ways is what turned "prod is missing modules" from a
// claim into a measurement, with dev as the control that came back clean.
//
// It reads `convex function-spec`, which reports what the deployment actually
// serves, rather than trusting the deploy command's own exit code. A deploy
// that silently pushed nothing exits 0 too.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CONVEX_DIR = "convex";

/** Files in `convex/` that are not deployable function modules.
 *
 *  `schema` and `auth.config` are configuration the deployment consumes rather
 *  than modules it serves, and `http`/`router` register HTTP routes that
 *  `function-spec` reports by PATH, not by module name — so a live
 *  `/stripe-webhook` proves them without ever naming them. Listing them as
 *  expected modules would make this check permanently, wrongly red. */
const NOT_A_MODULE = new Set(["schema", "auth.config", "tsconfig", "http", "router"]);

/** Does Convex bundle this file at all?
 *
 *  Mirrors the entry-point rules in convex/dist/cjs/bundler/index.js (1.50):
 *  no dotfiles, no `#` editor temp files, and nothing with more than one dot in
 *  its name. The last rule is the one that matters here: it is why `*.test.ts`
 *  and `mcp.testkit.ts` never deploy. This used to match only `.test`/`.spec`,
 *  so it expected `mcp.testkit` on the deployment and went red for it. */
function isEntryPoint(file) {
  if (!file.endsWith(".ts")) return false;
  if (file.startsWith(".") || file.startsWith("#")) return false;
  return (file.match(/\./g) ?? []).length === 1;
}

/** The builders whose exports `function-spec` lists by module name. HTTP
 *  actions are left out on purpose: they are reported by route path. */
const BUILDERS = "query|mutation|action|internalQuery|internalMutation|internalAction";

/** `export const f = query(` and the forms around it: a type annotation, the
 *  builder on the next line, a type argument (`query<T>(`), a wrapper call
 *  (`withUser(mutation(`), and `export default action(`. On 11-20-2026 the repo
 *  used only the plain form; the others are pinned in the tests so a refactor
 *  to one of them cannot quietly turn a module into a "helper". */
const REGISTERS = new RegExp(
  "^export\\s+(?:const\\s+[A-Za-z_$][\\w$]*\\s*(?::[^=;]+)?=|default)\\s*" +
    "(?:[A-Za-z_$][\\w$.]*\\s*\\(\\s*)*" +
    `(?:${BUILDERS})\\s*[(<]`,
  "m",
);

/** True when the source exports at least one registered Convex function.
 *  Block comments are dropped first; a `//` line never starts with `export`. */
export function registersFunction(source) {
  return REGISTERS.test(source.replace(/\/\*[\s\S]*?\*\//g, ""));
}

/** Which modules must be live on the deployment, and which are helpers.
 *
 *  Derived from the source, not a hand-kept list. The list this replaces
 *  (`NO_CALLABLE_EXPORTS`) was right when written and wrong two features later:
 *  MCP and pairing added six helpers (`mcpAuth`, `mcpClaims`, `mcpHttp`,
 *  `mcpImage`, `mcpTools`, `pairLimits`), nobody added them to the list, and
 *  master's deploy job was red from 11-18-2026 on a deploy that worked.
 *
 *  A helper registers no query, mutation or action, so `function-spec` never
 *  names it and a client cannot call it — there is nothing for #121 to break. */
export function classifyModules(dir = CONVEX_DIR) {
  const expected = [];
  const helpers = [];
  for (const file of readdirSync(dir).filter(isEntryPoint).sort()) {
    const name = file.replace(/\.ts$/, "");
    if (NOT_A_MODULE.has(name)) continue;
    (registersFunction(readFileSync(join(dir, file), "utf8")) ? expected : helpers).push(name);
  }
  return { expected, helpers };
}

/** Passed through to every CLI call, so `--prod` selects the deployment for
 *  the target assertion and the module check alike. */
const PROD = process.argv.includes("--prod") ? ["--prod"] : [];

/** Scopes a CONVEX_DEPLOY_KEY needs for this script, and why each one.
 *
 *  `deployment:deploy`     push code, schema and auth config.
 *  `deployment:data:view`  read `function-spec` back. BOTH checks here are
 *                          reads: "am I pointed at the right deployment" and
 *                          "did the modules land". A key with deploy alone can
 *                          push and cannot prove anything about what it pushed.
 *
 *  Convex does not document that `function-spec` needs the data scope — it was
 *  learned from a red CI job, so it is written down here rather than rediscovered. */
const REQUIRED_SCOPES = "deployment:deploy + deployment:data:view";

function convex(args) {
  try {
    return execFileSync("pnpm", ["exec", "convex", ...args, ...PROD], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    // A permission failure is the one error with a known, two-minute remedy, so
    // say the remedy instead of a Node stack trace. Everything else re-throws:
    // guessing at an unknown failure is how a check starts lying.
    const stderr = String(err?.stderr ?? "");
    if (/do not have permission/i.test(stderr)) {
      const scope = stderr.match(/\((deployment:[a-z:]+)\)/)?.[1] ?? "an unknown scope";
      console.error(`::error::CONVEX_DEPLOY_KEY is missing the ${scope} permission, so nothing was verified.`);
      console.error("");
      console.error(`  This script needs ${REQUIRED_SCOPES}.`);
      console.error("  Convex dashboard -> Production -> Deploy keys -> generate with BOTH boxes ticked,");
      console.error("  then GitHub -> Settings -> Secrets and variables -> Actions -> CONVEX_DEPLOY_KEY.");
      console.error("");
      console.error("  Nothing was deployed. Re-run this job after replacing the secret.");
      process.exit(1);
    }
    if (stderr) process.stderr.write(stderr);
    throw err;
  }
}

/** What the deployment actually serves: its URL, and the modules it holds.
 *
 *  `function-spec` answers with `{ url, functions }`. The CLI and the MCP
 *  server disagree on this shape — MCP hands back a bare array — so both are
 *  accepted rather than assuming the one that happened to be in front of me. */
function deployed() {
  const raw = JSON.parse(convex(["function-spec"]));
  const functions = Array.isArray(raw) ? raw : raw.functions;
  const url = Array.isArray(raw) ? null : raw.url;
  const modules = new Set();
  for (const fn of functions) {
    // "userColors.js:listUserColors" → "userColors". HTTP actions carry a
    // `path` and no identifier, so they contribute nothing here by design.
    const id = fn.identifier;
    if (typeof id !== "string") continue;
    modules.add(id.split(":")[0].replace(/\.js$/, ""));
  }
  return { url, modules };
}

/** Am I pointed at the deployment I think I am?
 *
 *  Asked BEFORE deploying, and it is the whole reason this runs as a separate
 *  step. `convex deploy` targets whatever deployment its key belongs to and
 *  says so only in passing, so a dev-scoped key in the prod secret would push
 *  a green, successful, completely wrong deploy. Reading the URL back as data
 *  beats scraping it out of the deploy log. */
function assertDeployment(expected) {
  const { url } = deployed();
  if (url !== expected) {
    console.error(`::error::Convex is pointed at ${url ?? "an unknown deployment"}, not ${expected}.`);
    console.error("The CONVEX_DEPLOY_KEY secret points somewhere unexpected. Nothing was deployed.");
    process.exit(1);
  }
  console.log(`ok  deploy target is ${expected}`);
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--expect-deployment");
  if (i !== -1) {
    const expected = argv[i + 1];
    if (!expected) {
      console.error("--expect-deployment needs a URL");
      process.exit(2);
    }
    assertDeployment(expected);
    return;
  }

  const { expected, helpers } = classifyModules();
  const { url, modules: live } = deployed();
  const missing = expected.filter((m) => !live.has(m));
  // The guard on the derivation itself. A helper cannot be live, so one that
  // IS means the scan missed a registration form, and every module written that
  // way would be silently unchecked. Fail loudly instead.
  const misread = helpers.filter((m) => live.has(m));

  console.log(`deployment:       ${url ?? "(unreported)"}`);
  console.log(`expected live:    ${expected.length}`);
  console.log(`helpers (no callable exports): ${helpers.join(", ") || "(none)"}`);
  console.log(`live on backend:  ${live.size}`);

  if (misread.length) {
    console.error(`::error::${misread.length} module(s) the scan called helpers ARE on the deployment: ${misread.join(", ")}`);
    console.error("They register a function in a form REGISTERS does not match. Teach the scan that form; a module it misreads is a module this check cannot vouch for.");
    process.exit(1);
  }

  if (missing.length) {
    console.error(`::error::${missing.length} module(s) in the repo are NOT on the deployment: ${missing.join(", ")}`);
    console.error("A client calling one of these gets a missing-function error, which is how #121 blanked the screen.");
    process.exit(1);
  }

  console.log(`ok  every module that registers a function is live (${expected.join(", ")})`);
}

// Run only as a script, so the tests can import classifyModules.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
