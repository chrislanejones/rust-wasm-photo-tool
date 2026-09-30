# Vercel builds — what skips, and why

Two Vercel projects are git-linked to this repo. Both used to build on every
push to every branch. They now skip a push that cannot change what they serve.

| Project | Root Directory | Config | Serves |
|---|---|---|---|
| `image-horse` | repo root | `vercel.json` | the editor, edit.imagehorse.app |
| `image-horse-marketing` | `marketing/` | `marketing/vercel.json` | the marketing site, imagehorse.app |

`vercel.json` cannot carry comments (the schema rejects any unknown key,
`"//"` included, before a build starts), so the reasoning lives here.

## The rule

Each config's `ignoreCommand` runs `scripts/vercel-ignore-build.sh` with a
list of paths that project never reads. The script **skips** only when every
file changed since the branch's last real deployment is on that list.
Anything it cannot establish is a **build**:

| Situation | Verdict |
|---|---|
| a Dependabot branch | skip |
| no previous deployment on the branch (a new branch) | build |
| the previous deploy's SHA is outside Vercel's shallow clone | build |
| nothing changed at all (an empty commit — the way to force a redeploy) | build |
| any changed file not on the list | build |
| every changed file on the list | **skip** |

The lists are **exclusions**, so a forgotten entry costs one wasted build.
Listing what each project reads instead would fail the other way: forget one
input and a change to it never ships, behind a green deploy.

Vercel's exit codes run backwards — **0 means skip**, 1 means build — so the
script prints which way it went and why. It is the first thing in the build
log: `▶ BUILD — …` or `⏭ SKIP — …`.

## The lists

**Editor** skips a push that only touches `marketing/`, `docs/`,
`.design-sync/`, `.github/`, `e2e/`, `tests/`, `benches/`, or a root-level
`*.md`. Checked: the app build reaches outside `app/` only for `convex/`, and
`build-wasm.sh` and `write-build-info.sh` read no docs.

**Marketing** skips a push that only touches `app/`, `src/` (the Rust engine,
root only — never `marketing/src/`), `convex/`, `docs/`, `tests/`, `benches/`,
`e2e/`, `.design-sync/`, `.github/`, `Cargo.toml`, `Cargo.lock`,
`rust-toolchain.toml`, the root `vercel.json`, or a root-level `*.md`.
Checked: nothing under `marketing/` imports or reads a path outside it. Root
`package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` are deliberately
**not** on either list, since both installs read them.

Add a directory to a list only after checking that project's build never
reads it. Adding a new top-level directory needs nothing: it builds.

**Dependabot** never deploys at all — `git.deploymentEnabled` blocks
`dependabot/**` before a deployment is created. The `**` matters: minimatch's
`*` does not cross `/`, and Dependabot branches are
`dependabot/<ecosystem>/<dependency>`.

## Testing a change to the script

```bash
bash scripts/vercel-ignore-build.test.sh
```

Fifteen cases in a throwaway repo, each asserting the verdict and the reason.
It is **not in CI** — run it by hand after touching the script or a list.

## What this is for, in numbers

September 2026, from the team's usage API: 942 builds, 1,401 build minutes,
1,731 minutes queued (Hobby allows one build at a time), and 103 builds on
09-17 against Hobby's 100-a-day cap. Replaying all 234 master commits since
09-01 through the script: 468 builds become 317.

**A skip still creates a deployment record.** Measured on PR #252: the skipped
build appears as a CANCELED deployment ("canceled because the Ignored Build
Step command returned exit code 0"). The build minutes and the queue slot are
saved; whether a CANCELED deployment counts toward the 100-a-day cap, Vercel's
docs do not say — assume it may. Only `git.deploymentEnabled` stops a
deployment from existing at all, and it works by branch, not by path.
