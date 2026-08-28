// ESLint flat config. Named `.mjs` because the workspace root package.json has
// no `"type": "module"` — as `eslint.config.js` this file would be read as CJS
// and die on the imports below.
//
// Scope: correctness only. No formatting or style rules — those are noise here
// and nothing in this repo formats via ESLint.
//
// Deliberately NOT enabled yet (each is its own decision, not a side effect of
// getting a linter running):
//   - Entropy/drift rules beyond `max-lines` (which is now ON — see the
//     ratchet block at the bottom; the baseline it was waiting for is
//     docs/Entropy-Refactor-Plan.md).
//   - The React Compiler rule set that ships in eslint-plugin-react-hooks v7's
//     `recommended` (17 rules, 14 of them `error` — purity, immutability,
//     set-state-in-effect, preserve-manual-memoization, …). Real correctness
//     rules, but a large new surface on code that has never been linted. The
//     two classic hook rules below are the historical "recommended" and are
//     what this gate starts from.
//   - Type-aware linting (`recommendedTypeChecked`). Needs a TS program per
//     lint run; slower, and a much bigger initial wave.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "pkg/**", // wasm-pack output
      "target/**", // cargo output
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "**/*.d.ts", // declaration files, incl. the hand-synced stamp_tool.d.ts
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["app/src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // The codebase already marks deliberately-unused bindings with a leading
      // underscore (`_settings`, `_onChange`, a `_dropped` rest-omit). Honour
      // that existing convention rather than making it rewrite itself.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // The two classic hook rules. `rules-of-hooks` is a hard error because a
      // conditional hook is always a bug; `exhaustive-deps` is a warning
      // because its autofix can change behaviour and each case wants a human.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Two rules ADOPTED from the React Compiler set — see ADR-020. Both are
      // at zero violations as of this commit, so they gate against regression
      // rather than describing a backlog.
      //   static-components: a component defined during render remounts on
      //     every parent render, silently resetting its own state.
      //   purity: randomness/clock reads during render make output depend on
      //     WHEN React chose to render, which is not something a caller controls.
      // The rest of the set stays off: `refs` (31 open, held pending a
      // useLatestRef/useEffectEvent migration) and `set-state-in-effect`
      // (18 open, 15 of which are correct code that would need suppressions).
      "react-hooks/static-components": "error",
      "react-hooks/purity": "error",

      // Vite HMR: a module mixing component and non-component exports silently
      // breaks fast refresh for that file.
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  {
    // Vitest specs are excluded from app/tsconfig.json's `include`, so tsc
    // never sees them — no `noUnusedLocals`/`noUnusedParameters` there. ESLint
    // is the only checker that covers these files at all.
    files: ["app/src/**/*.test.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    // ── Export paths: exhaustive-deps is an ERROR here, not a warning ───────
    //
    // Repo-wide, `react-hooks/exhaustive-deps` is a warning and there is a
    // backlog of ~59. That is deliberate (see CLAUDE.md) and this override is
    // NOT a step toward `--max-warnings 0`. It is scoped to the handful of
    // files where a stale closure does not merely re-render late — it writes
    // the wrong bytes to a file the user keeps.
    //
    // `useCanvasActions.handleExport` omitted `exportCanvasBackground` from
    // its dependency array while reading it in the body, so flipping Settings
    // → Layers and Canvas → "Photo only" and pressing Download immediately
    // gave you the PREVIOUS setting's output. Nothing failed, nothing warned
    // loudly, and the file looked plausible. The warning naming the exact
    // identifier had been sitting in the backlog the whole time.
    //
    // A warning among 59 warnings is not a check. In these files it fails.
    //
    // Scoped to two files on purpose. The rest of `app/src/app/session/` was
    // tried and reverted: it raises ~15 more, and nearly all of them are
    // zustand setters (`setPhotos`, `setHasBeenModified`) pulled out with
    // `useGalleryStore(s => s.setX)`. Those references are stable, so the
    // warnings are false here — but ESLint cannot know that, and "just add
    // them to the deps" changes memoization on the photo-switch path, which
    // is not a change to make without measuring. Widen this glob file by
    // file, each with its own reasoning, not in one sweep.
    files: ["app/src/app/session/useCanvasActions.ts", "app/src/hooks/useExport.ts"],
    rules: {
      "react-hooks/exhaustive-deps": "error",
    },
  },

  {
    // ── THE max-lines RATCHET ──
    //
    // 900 lines is not a style opinion; it is the point past which every file
    // in this repo that crossed it kept going. AppShell went 3,314 -> 3,806
    // WHILE it was being dismantled, so accretion outpaced extraction for a
    // month without anything saying so out loud. This is the thing that says
    // so out loud.
    //
    // `warn`, not `error`, on purpose: the lint gate is errors-only, so a new
    // 901-line file must not block a push on the day it appears. It shows up
    // in the warning count instead, which is where this repo keeps its
    // backlog.
    //
    // The five overrides below are TODAY'S line counts, measured 2026-08-27,
    // not round numbers. That is what makes this a ratchet:
    //
    //   THE RULE — when an extraction lands, lower that file's number to its
    //   new size IN THE SAME COMMIT. These numbers only ever go down. Raising
    //   one is not a fix, it is the ratchet being unbolted.
    //
    // Any file NOT on this list that trips 900 is a new AppShell being born,
    // which is the entire point of the rule. Do not answer that by adding it
    // here.
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "max-lines": ["warn", { max: 900, skipBlankLines: false, skipComments: false }],
    },
  },

  {
    // The four legacy giants + the one long contract test, pinned at their
    // 2026-08-27 sizes. Ordered biggest first, which is also roughly the
    // order docs/Entropy-Refactor-Plan.md Phase 4 works through them.
    files: ["app/src/app/AppShell.tsx"],
    rules: { "max-lines": ["warn", { max: 3806 }] },
  },
  {
    files: ["app/src/features/canvas/CanvasArea.tsx"],
    rules: { "max-lines": ["warn", { max: 2959 }] },
  },
  {
    files: ["app/src/features/tools/settings/BatchSettings.tsx"],
    rules: { "max-lines": ["warn", { max: 1428 }] },
  },
  {
    files: ["app/src/hooks/useDrawingTools.ts"],
    rules: { "max-lines": ["warn", { max: 1173 }] },
  },
  {
    // A test file, not a god object — it is long because it enumerates 166
    // engine call sites. Pinned so it cannot drift upward unnoticed either.
    files: ["app/src/lib/engine/engineAsyncMigration.contract.test.ts"],
    rules: { "max-lines": ["warn", { max: 1015 }] },
  },

  {
    // This config file itself: ESM running under Node.
    files: ["eslint.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
);
