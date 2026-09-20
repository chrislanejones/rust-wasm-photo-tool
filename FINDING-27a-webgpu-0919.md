# FINDING — #27a: the WebGPU read, settled

**09-19-2026.** Worktree `~/ai-repo/webgpu-read`, branch `docs/webgpu-27a-finding`,
off `chore/trail-squares-0919` (master at `3325ed0e`).

**Pure reading. No code changed, nothing shipped, no issue closed.** Line numbers
below are repo-relative and were read in this worktree; production evidence was
fetched over the network and is dated inline.

---

## The four questions

| # | Question | Answer | Evidence (file:line) |
|---|---|---|---|
| **1** | Does a preview accelerator exist past the adapter probe? | **YES — and it ships.** `applyGlobalBlur` has a live GPU branch: flag gate, in-flight guard, adapter check, shader call, engine hand-back, CPU fallback on every failure. ⚠️ It accelerates the **committed** whole-image blur, not a live preview — the slider commits on release. Reachable from the UI through four hops. | `app/src/hooks/useTransforms.ts:295` (`applyGlobalBlur`), `:328` (`webgpuEnabled()` gate), `:332` (in-flight guard), `:342` (`gpuUsable()`), `:364` (`gaussianBlurGpu(...)`), `:378` (`apply_blurred_layer_rgba`). UI chain: `app/src/app/AppShell.tsx:3092` → `app/src/features/tools/ToolsSidebar.tsx:439` → `app/src/features/tools/settings/EffectsSettings.tsx:250` (Blur slider) → `:107` (`commitBlur`). Engine side: `src/effects.rs:110` `gaussian_kernel`, `:116` `active_layer_rgba`, `:136` `apply_blurred_layer_rgba`. Landed `111bfe5b` **09-09-2026**, released in **v8.73**. |
| **2** | Is there a WGSL blur, and how does it relate to `blur.rs`? | **YES — a separable Gaussian compute shader, 61 lines of WGSL.** It is a hand port of the engine's arithmetic, not of its kernel: the kernel is **fetched from the engine at runtime** and passed in, because `f32::exp` is not reproducible in JS. Three files form a triangle — the Rust, the WGSL, and a JS oracle — and **two** guardrail pairs tie its edges. | Shader: `app/src/lib/webgpu/gpuBlur.ts:26-88` (one code path for both passes, clamp-to-edge, u8 requantized between passes, `floor(x+0.5)` packing because WGSL `round()` is half-to-even and Rust is not — `:50-60`). Rust: `src/simd/blur.rs:25`/`:38` (scalar), `:77`/`:106` (SIMD). Kernel as an input: `app/src/hooks/useTransforms.ts:354-357` ← `src/filters.rs:74`. Oracle: `app/src/lib/webgpu/blurReference.ts:1-50` (header records it was **wrong for its whole life** — f64 accumulation vs the crate's f32, invisible below 64×64). Guardrails: `scripts/guardrails.sh:238` `blur-oracle-pair` (Rust ↔ oracle), `:313` `blur-shader-pair` (Rust ↔ WGSL). Both **skip** with no `origin/master`, and nothing runs them but CI and the pre-push hook. |
| **3** | What does the feature flag actually gate? | **Three things, and its own description names only one.** `ih_webgpu` gates (a) the three `window.__ihGpuBlur*` harnesses, (b) **the live GPU blur branch**, and (c) nothing else — the hardware probe deliberately ignores the flag so diagnostics work with it off. ⚠️ **The flag's shipped description is false**: it still says no pixel goes near the GPU. Written 08-04-2026, never updated after the 09-09 wiring. The flag is user-flippable **without devtools**. | Read: `app/src/lib/webgpu/detect.ts:77-84`. (a) `app/src/main.tsx:27-30` → `app/src/lib/webgpu/selfTest.ts:440-445`. (b) `app/src/hooks/useTransforms.ts:328`. (c) `app/src/lib/webgpu/detect.ts:98-101` (probe does not consult the flag), panel at `app/src/components/FeatureFlagsPanel.tsx:84-95`, `:118-128`. **Stale text:** `app/src/lib/featureFlags.ts:122` — *"No pixel in the app goes near the GPU yet — this only exposes window.\_\_ihGpuBlurSelfTest()"*, introduced `e586246f` (08-04-2026), unchanged since. Flip path: Alt+Delete (`app/src/app/AppShell.tsx:2610`, `:2784-2787`) → Feature flags tab → `app/src/components/FeatureFlagsPanel.tsx:79`. |
| **4** | Does anything in the **SHIPPED** build reach a GPU path? | **The code ships. By default nothing runs it.** The whole path — flag read, software-adapter refusal list, full WGSL shader, wired blur branch, engine hand-back — is present verbatim in the bundle production serves. It executes only when a user sets `ih_webgpu=1` **and** the machine returns a non-software adapter. Whether any real user has done so: **not determined** (no telemetry inspected). | Fetched **09-19-2026**: `https://edit.imagehorse.app/assets/index-Bp19bF1i.js`, HTTP 200, 3,176,571 B. Present: `localStorage.getItem("ih_webgpu") === "1"`; `["swiftshader","llvmpipe","lavapipe"]`; `@compute @workgroup_size` / `global_invocation_id` / `read_write`; and the branch itself — `if (!qO() \|\| typeof n11.active_layer_rgba != "function") { o11(); return; }` … `if (!await ZO())` … `await n11.apply_blurred_layer_rgba(u11)`. Also present: the stale flag text from Q3, shipped verbatim. Controls in the same sweep (all positive, so a miss would have meant something): `ih_engine_worker`, `ih_patchmatch`, `blur_whole_image`, `gaussian_kernel`. |
| **5** | Where does **"17× faster"** come from? | **ADR-030's 09-07-2026 bench: 2048×2048, radius 5 — engine SIMD 512.4 ms vs GPU 29.1 ms = 17.6×.** Real hardware, real production build, parity re-verified first, adapter vendor asserted. **But measured by a console script that bypasses the app and the flag entirely**, eight days before the marketing copy shipped and two days before the app wiring existed. The post-integration number was never taken. | Number: `docs/adr/030-webgpu-runs-in-js-not-in-the-crate.md:77` (heading), `:87-93` (table). Mirrored `docs/Change-summary.md:10349-10355`, `docs/adr/INDEX.md:55`. Instrument: `scripts/webgpu-blur-bench.js:8-10` — *"It needs no build and no feature flag … without either being wired up."* Never re-measured: `docs/adr/030-…:306` *"Nothing was timed inside the app"*; `~/ai-repo/webgpu-flag-readiness-0910.md` §2 *"STILL NOT TAKEN."* Claim live at `marketing/src/pages/Home.tsx:219`, served **09-19-2026** in `https://imagehorse.app/assets/index-CqY33mFe.js`. |

---

## Why the three claims disagree: a timeline, not a mystery

| Date | Event | Effect on #27a |
|---|---|---|
| 08-04-2026 | ADR-030 drafted; `ih_webgpu` flag + description added (`e586246f`) | Harness only. Description accurate. |
| **09-01-2026** | Verification: *"No WebGPU preview accelerator exists — only a self-test installer and an adapter probe"* (`~/ai-repo/night-0901.md:102-103`) | **True on this date.** #27a reopened. |
| 09-02-2026 | #27a carried as *"reopened — a Phase 0 probe, not an accelerator"* (`~/ai-repo/day-0902.md:47`) | Still true. |
| 09-04-2026 | ADR-043 drafted: *"Consumers of `gpuBlur` outside `lib/webgpu/`: **zero**"* (`~/ai-repo/adr-043-webgpu-draft.md`) | Still true. Never filed to `docs/adr/`. |
| 09-07-2026 | The bench runs. 5.3× / 11.7× / 17.6× / 53.8× | Numbers exist. Nothing is wired. |
| **09-09-2026** | **`111bfe5b` wires the GPU blur into `applyGlobalBlur`.** Released in **v8.73** | **Every claim above becomes false.** A preview accelerator now exists and ships. |
| 09-10-2026 | Readiness audit: *"#27/#28 'not doing' list — could not be located anywhere in tracked docs … Premise unverified; say where it lives."* (`~/ai-repo/handoff-0910.md:60-61`) | The not-doing premise is already flagged as unverified. Never answered. |
| 09-17-2026 | Marketing GPU row ships (`3f36836e`), citing `featureFlags.ts`'s stale sentence as its authority | A stale fact is copied onto the front page. |
| 09-19-2026 | This read | — |

The contradiction is a **stale snapshot**, not a lie: the 09-01 verification was
correct and was overtaken eight days later. What has not happened since is any
update to the three places that still say otherwise.

**Three surfaces still assert "no pixel goes near the GPU", all of them wrong since v8.73:**

| Surface | Line | Ships to |
|---|---|---|
| Feature-flag description | `app/src/lib/featureFlags.ts:122` | **Production bundle**, verbatim |
| Architecture doc | `docs/Architecture.md:379-382` | Repo readers |
| Marketing home page | `marketing/src/pages/Home.tsx:228` | **imagehorse.app**, live |

⚠️ **Marketing's own data file got it right and the JSX got it wrong.**
`marketing/src/data/releases.ts:223` (v8.73) reads *"The GPU blur is **wired up**
behind a flag that is still off … falls back to the processor on every failure."*
That is accurate. The hand-written prose in `Home.tsx` contradicts the data file
sitting next to it.

---

## The 17× claim

The number is real. It is not estimated, not modeled, and not taken on a software
rasterizer — the one failure mode ADR-030 spends a whole section warning about.
`scripts/webgpu-blur-bench.js:12-19` refuses to print timings when the adapter
vendor matches `swiftshader`/`llvmpipe`/`lavapipe`, parity is re-verified before
anything is timed, and the run that produced 17.6× was on a confirmed
`intel/xe-lpg` adapter in Chrome 149 against a production build
(`docs/adr/030-…:77`). Taken on its own terms, the measurement is careful work.

What it measured is the problem. The bench's own header says it plainly
(`scripts/webgpu-blur-bench.js:8-10`): *"It needs no build and no feature flag: it
imports the engine module straight off the page and carries its own copy of the
shader, so it measures the shipped SIMD blur against the shipped WGSL **without
either being wired up**."* On 09-07-2026 there was nothing to wire it to — the
integration landed two days later. So 17.6× is the distance between two functions
called directly from a console, with no app, no flag, no worker hop, no scheduling,
and no engine round-trip through the boundary that ADR-030 itself measures as **78%
of the cost**.

That gap was noticed at the time and never closed. ADR-030's own "What this does
not settle" (`:306`) says *"Nothing was timed inside the app."* The readiness audit
three days later (`~/ai-repo/webgpu-flag-readiness-0910.md` §2) is blunter: *"The
post-integration measurement — STILL NOT TAKEN … the claim 'the win survived
integration' therefore remains unproven."* Nine days on, it still is. ADR-030 offers
an upper bound of ~+4.6 ms for the two wasm copies at 1024², which would leave the
win's sign untouched — but a bound reasoned from other measurements is not the
measurement, and the transfer floor that dominates is precisely the number ADR-030
says moves most across hardware, on the one laptop every figure came from.

So, in the terms asked for: **this is a live claim on the front page about a code
path with no users.** The path ships off; the only way to it is Alt+Delete →
Feature flags → WebGPU, on a machine with a real adapter; and how many people have
done that is not determined, because nothing counts it.

One correction to the premise, because it changes where the fault sits. The number
did **not** come from a flagged build. It came from a console script that needs no
flag and deliberately routes around the app. That is worse in one specific way and
better in another: better, because the shader and the engine it timed are both
exactly what production serves; worse, because the sentence on the home page points
at *the editor's blur*, and the editor's blur is the one configuration the number
was never taken in. The honest version of the claim is narrower than the one that
shipped — *"the shader beats the engine 17.6× at 2048 pixels on an Intel Xe-LPG,
measured outside the app"* — and the page has room for it.

⚠️ And the sentence four lines below the headline is now simply false.
`marketing/src/pages/Home.tsx:228` reads *"None of it touches a pixel in the editor
yet."* It touches pixels for every user with the flag on, and has since v8.73. The
commit that wrote it (`3f36836e`, 09-17-2026) records its reasoning in full: it
rejected the design's copy as untrue and went to `featureFlags.ts` for the truth —
and `featureFlags.ts` had been stale for eight days. **The page was carefully
fact-checked against a fact that had already expired.** That is the more useful
lesson here than the 17× itself: the copy is only as fresh as the string it cites,
and nothing in this repo makes a flag's description go red when the flag's behavior
changes.

---

## Verdict — which of the three contradictory claims is false

| Claim | Verdict |
|---|---|
| **1.** #27a is recorded as completed with byte-identical parity | **HALF TRUE, and misattributed.** Byte-identical parity is real and recorded — max channel delta 0 over 41,128 channels (`docs/adr/030-…:45-46`, Consequences; re-confirmed `:84-85`), and a third harness checks the shader against the **real engine** rather than the oracle (`app/src/lib/webgpu/selfTest.ts:234-240`). But no record anywhere says #27a is **completed** — the last word on it is *"reopened"* (`~/ai-repo/day-0902.md:47`). Parity being proven was read as the item being done. Two different facts. |
| **2.** #27 and #28 sit in the "not-doing" section | **FALSE — this is the one.** There is no such section. Searched this worktree (`docs/`, `docs/archive/`, `docs/adr/`, `PARKING_LOT.md`), the main checkout, and every `.md` under `~/ai-repo/`: no tracked file carries a #27/#28 not-doing list. This was already recorded as unverified on 09-10-2026 — *"could not be located anywhere in tracked docs … Premise unverified; say where it lives"* (`~/ai-repo/handoff-0910.md:60-61`) — and the question was never answered. The section is the claim with nothing behind it. |
| **3.** The 09-01 verification found only a self-test installer and an adapter probe | **TRUE ON ITS DATE, now stale.** Correct as written on 09-01-2026 and superseded by `111bfe5b` on 09-09-2026. Not a wrong observation — an un-refreshed one. |

**#27a itself is settled: its premise is dead.** *"No WebGPU preview accelerator
exists"* stopped being true on 09-09-2026. What exists is a GPU path for the
**committed** whole-image blur, shipping since v8.73, opt-in and default off, with
a CPU fallback on every failure branch. #27a should be closed against that fact —
**not by this session**, which is a read.

⚠️ **The not-doing section's reliability is not restored by this finding — it is
withdrawn.** The worry in the brief was that #27/#28 living in an unreliable
section made the section unreliable. The real answer is that the section could not
be found at all, twice, nine days apart. Until someone says where it lives, nothing
should be scoped off it.

---

## Not determined

Written as gaps rather than guesses, per the repo's own rule about hedges becoming
load-bearing.

| Question | Why it is open |
|---|---|
| Has any real user ever set `ih_webgpu=1`? | No telemetry inspected. The flag is client-side `localStorage`; nothing counts it. |
| What is the speedup **through the app**? | Never measured. Owed since 09-09-2026. |
| Does parity hold on hardware other than Intel Xe-LPG? | One laptop, every figure, both ADRs. Discrete and Apple GPUs unmeasured. |
| Does a GPU whole-image blur survive a reload? | ADR-030 flags it itself as *"Not verified"* — archive/pixel persistence, not the op log. |
| Where does the #27/#28 not-doing section live? | Two searches, nine days apart, both empty. |
| Is ADR-030 still only a draft? | Yes — `docs/adr/030-…:2` reads `Status: draft`, and ADR-043 was never filed to `docs/adr/` at all. Whether either should now be accepted is Chris's call, not a finding. |

## Adjacent, not acted on

- **The marketing site has a second, unflagged WebGPU path.** `CubeLetters` draws
  the home page's WEBGPU letters with its own ~60-line WGSL and falls back to
  canvas 2D, labeling which one ran (`marketing/src/components/CubeLetters.tsx:81`,
  `:285-310`, `:239`, `:425-463`). It runs for any visitor with an adapter, no flag.
  It touches no photo. Worth knowing before anyone says "no WebGPU ships."
- **Zero e2e coverage.** No spec under `e2e/` or `tests/` mentions WebGPU or
  `ih_webgpu`. The only automated coverage is `app/src/lib/webgpu/detect.test.ts`
  and `blurReference.test.ts`, and neither can run a shader — there is no WebGPU in
  jsdom or on GitHub's runners.
- **`gpuBlur` was never a lost export.** ADR-043's *"zero consumers"* was accurate
  when written and is now connected — never-connected-then-connected, not
  lost-then-found. Separately, `gpuBlurSelfTest` lost its `export` keyword on
  09-09-2026 and took `dead-exports` 1 → 0 (`scripts/guardrails.sh:220-229`).
