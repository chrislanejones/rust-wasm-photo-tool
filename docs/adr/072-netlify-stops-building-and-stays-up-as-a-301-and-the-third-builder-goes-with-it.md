# ADR-072: Netlify stops building and stays up as a 301, and the third builder goes with it
Date: 2026-09-27   Status: draft

## Context
Netlify had not compiled this tree since 2026-09-17. From 2026-09-22 onward,
**100 consecutive deploys** — production and deploy-preview alike — ended with
"Skipped due to account builds usage exceeded" on the free plan, so the host
contributed nothing but a red check on every PR, and its build quota is wanted
for a different project. Deleting the site was not free: `app/src/lib/legacyHost.ts`
and `app/src/features/hostMove/MovedNotice.tsx` show signed-out visitors on the
legacy origin a notice that the address forwards on September 29, and a
signed-out gallery lives in per-origin IndexedDB that does not follow the user.

## Decision
Retire Netlify as a build and deploy host; keep the site as a redirect. A
prebuilt two-file deploy (`_redirects` + `index.html`, via
`netlify deploy --no-build --prod`) serves `/*` → `https://edit.imagehorse.app/:splat`
as a **301** — verified live on `/`, `/?tool=crop` and a deep path, each with
path and query preserved and each following through to a 200. `build_settings.stop_builds`
is `true` and `build_settings.cmd` is empty. `netlify.toml` and `.netlify/` are
out of the repo, along with the `policiesFromNetlifyToml` parser in
`app/src/lib/cspInlineHash.test.ts`, which read that file from disk and would
have thrown ENOENT.

## What retiring the host proved
PARKING_LOT #56 had tracked, since 2026-09-04, a stale build command in the
Netlify UI — no `--features tiles,patchmatch`, `--default-toolchain stable`, an
unpinned `cargo install wasm-pack`, and `pnpm ci`, which is not a command. It
was filed as a loaded gun rather than a live fire, because `netlify.toml`
overrode it. Retiring the host fired it: a `netlify deploy` run from a directory
containing no `netlify.toml` resolved the command from the UI instead — the log
says `commandOrigin: ui` — and ran it. The override was the only thing standing
between that setting and a featureless production build, which is the v7.36–v7.45
bug exactly (ten releases shipped without `--features tiles,patchmatch`). The
lesson is narrower than "clear the UI setting": **an override hiding a bad
default is not a fix, and you find out which of the two you had on the day the
override goes away.**

One CLI trap, recorded because it cost a wrong-looking no-op:
`netlify api updateSite --data '{"site_id":"…","build_settings":{…}}'` returns the
site JSON and changes nothing. The mutation must be wrapped —
`--data '{"site_id":"…","body":{"build_settings":{…}}}'`. The un-wrapped form is
what #56 had written down as the fix.

## Consequences
+ A red check that could not pass stops appearing on every PR, and the build
  minutes go to the project that wants them.
+ Every old `rust-wasm-photo-tool.netlify.app` link keeps working, which is what
  the September 29 notice promised.
+ PARKING_LOT #56 closes by removal — there is no build command left to be stale.
- **The three-builder quorum is gone, and that is the real cost.** netlify.toml's
  own header argued for keeping the host: after the move to Vercel the same
  commit built four ways, and laptop, CI and Netlify all produced 823,503 B /
  `102e26d9…` while Vercel alone produced 823,479 B / `0383b226…`. That 3-against-1
  split is how Vercel's `CARGO_HOME=/rust` was found to match none of
  `.cargo/config.toml`'s `--remap-path-prefix` entries. It is now CI against
  production, one against one; the next drift has no tie-breaker in automation,
  and the laptop becomes the third opinion only if someone deliberately uses it.
  Prior art: ADR-037, ADR-038, ADR-045, ADR-046.
- `legacyHost.ts` and `features/hostMove/` are now unreachable dead code, left in
  place on purpose for a separate session.
- The GitHub repo is still linked to the Netlify site: the API silently ignores
  both `{"repo":null}` and `{"build_settings":{"repo_url":null,…}}`. Cosmetic
  while builds are stopped, but it needs the UI, and it is a new open item in
  PARKING_LOT.md.

## Alternatives rejected
1. **Delete the site outright.** Breaks the September 29 forward two days early
   and frees the subdomain for anyone to claim.
2. **Stop builds and leave the 09-17 app build serving.** Two live copies of the
   editor on different origins — the drift risk the host move existed to end.
3. **Pay for build minutes.** Buys back the third builder, but nobody was reading
   it and the account is wanted elsewhere.

## Pre-mortem
It is six months later and this was a mistake, because the tie-breaker was the
whole value and the laptop never stood in for it. A release comes around, the
sentinel's exact-hash assert (ADR-046) disagrees between CI and production, and
with only two builds there is no majority to appeal to — so the argument gets
settled by whichever number looks familiar and the expected value is edited to
match, which is how the band got wide enough to need ADR-045 in the first place.
The version of this that hurts is not a loud disagreement but a quiet one: two
builders can agree and still both be wrong, and nothing is left that would say so.
Early warning sign: a release where the sentinel hash disagrees and the fix
committed is a new expected value rather than a third build.
