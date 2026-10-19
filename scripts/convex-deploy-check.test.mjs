import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const checker = fileURLToPath(new URL("./convex-deploy-check.mjs", import.meta.url));
function check(t, live) {
  const root = mkdtempSync(join(tmpdir(), "convex-deploy-check-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "convex"));
  mkdirSync(join(root, "bin"));
  for (const name of ["photoEdits.ts", "aiJobs.ts", "photoEdits.test.ts", "aiJobs.spec.ts", "schema.ts"])
    writeFileSync(join(root, "convex", name), "");
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
  const result = check(t, ["photoEdits", "aiJobs"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /repo modules: +2/);
});

test("a missing application module still blocks verification", t => {
  const result = check(t, ["aiJobs"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /NOT on the deployment: photoEdits/);
  assert.doesNotMatch(result.stderr, /photoEdits\.test|aiJobs\.spec/);
});
