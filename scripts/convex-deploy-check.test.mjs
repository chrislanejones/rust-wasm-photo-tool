import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const checker = fileURLToPath(new URL("./convex-deploy-check.mjs", import.meta.url));
const repoConvex = fileURLToPath(new URL("../convex", import.meta.url));

const QUERY = `import { query } from "./_generated/server";\nexport const list = query({ args: {}, handler: async () => [] });\n`;
const HELPER = `export const LIMIT = 3;\nexport function clamp(n) { return Math.min(n, LIMIT); }\n`;

/** Run the checker in a scratch repo whose `convex/` holds `files`, against a
 *  fake `pnpm exec convex function-spec` that reports `live` as deployed. */
function check(t, files, live) {
  const root = mkdtempSync(join(tmpdir(), "convex-deploy-check-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "convex"));
  mkdirSync(join(root, "bin"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(root, "convex", name), body);
  writeFileSync(join(root, "bin", "pnpm"), `#!/usr/bin/env node
process.stdout.write(process.env.TEST_FUNCTION_SPEC);
`, { mode: 0o755 });
  return spawnSync(process.execPath, [checker], {
    cwd: root, encoding: "utf8",
    env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}`,
      TEST_FUNCTION_SPEC: JSON.stringify({ url: "https://test.invalid", functions:
        live.map(name => ({ identifier: `${name}.js:handler` })) }) },
  });
}

test("test/spec files are not expected production modules", t => {
  const result = check(t, {
    "photoEdits.ts": QUERY, "aiJobs.ts": QUERY,
    "photoEdits.test.ts": QUERY, "aiJobs.spec.ts": QUERY, "schema.ts": "",
  }, ["photoEdits", "aiJobs"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /expected live: +2/);
});

test("a missing module that registers a query still fails (the #121 case)", t => {
  const result = check(t, { "photoEdits.ts": QUERY, "aiJobs.ts": QUERY }, ["aiJobs"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /NOT on the deployment: photoEdits/);
});

test("a helper with only plain exports is not expected, and is named in the log", t => {
  const result = check(t, { "aiJobs.ts": QUERY, "pairLimits.ts": HELPER }, ["aiJobs"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /expected live: +1/);
  assert.match(result.stdout, /helpers \(no callable exports\): pairLimits/);
});

test("a file with more than one dot is skipped, as Convex skips it", t => {
  const result = check(t, { "aiJobs.ts": QUERY, "mcp.testkit.ts": QUERY }, ["aiJobs"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /expected live: +1/);
  assert.doesNotMatch(result.stdout + result.stderr, /mcp\.testkit/);
});

const FORMS = {
  query: `export const f = query({ handler: async () => 1 });`,
  mutation: `export const f = mutation({ handler: async () => 1 });`,
  action: `export const f = action({ handler: async () => 1 });`,
  internalQuery: `export const f = internalQuery({ handler: async () => 1 });`,
  internalMutation: `export const f = internalMutation({ handler: async () => 1 });`,
  internalAction: `export const f = internalAction({ handler: async () => 1 });`,
  "type annotation": `export const f: RegisteredQuery<"public", {}, number> = query({ handler: async () => 1 });`,
  "builder on the next line": `export const f =\n  internalMutation({ handler: async () => 1 });`,
  "type argument": `export const f = query<{ id: string }>({ handler: async () => 1 });`,
  "wrapper call": `export const f = withUser(mutation({ handler: async () => 1 }));`,
  "default export": `export default action({ handler: async () => 1 });`,
};
for (const [form, body] of Object.entries(FORMS)) {
  test(`form "${form}" is expected on the deployment`, t => {
    const result = check(t, { "aiJobs.ts": QUERY, "sync.ts": `${HELPER}${body}\n` }, ["aiJobs"]);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /NOT on the deployment: sync/);
  });
}

test("a builder named only in a comment or string does not count", t => {
  const body = `${HELPER}// export const f = query({})\nexport const NOTE = "export const g = mutation(";\n`;
  const result = check(t, { "aiJobs.ts": QUERY, "notes.ts": body }, ["aiJobs"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /helpers \(no callable exports\): notes/);
});

test("a helper that IS live means the scan missed a registration, and fails", t => {
  const result = check(t, { "aiJobs.ts": QUERY, "sync.ts": HELPER }, ["aiJobs", "sync"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /sync/);
  assert.match(result.stderr, /scan/);
});

test("today's repo: the MCP and pairing helpers are helpers, the rest still expected", async () => {
  const { classifyModules } = await import(checker);
  const { expected, helpers } = classifyModules(repoConvex);
  assert.deepEqual(helpers, [
    "aiCaps", "crons", "entitlement", "mcpAuth", "mcpClaims", "mcpHttp", "mcpImage",
    "mcpTools", "pairLimits", "storageOrphans", "storageQuota", "storedFiles", "testAccount",
  ]);
  // Convex never bundles a two-dot file, so it is neither expected nor a helper.
  assert.ok(!expected.includes("mcp.testkit") && !helpers.includes("mcp.testkit"));
  // Every module that was expected before this change still is.
  for (const m of ["ai", "aiJobs", "auth", "mcp", "mcpData", "pairSessions", "photoEdits", "shares",
    "storageSweep", "sync", "testReplicate", "userColors", "users"])
    assert.ok(expected.includes(m), `${m} should still be expected`);
});
