// ESLint flat config. Named `.mjs` because the workspace root package.json has
// no `"type": "module"` — as `eslint.config.js` this file would be read as CJS
// and die on the imports below.
//
// Scope: correctness only. No formatting or style rules — those are noise here
// and nothing in this repo formats via ESLint.
//
// Deliberately NOT enabled yet (each is its own decision, not a side effect of
// getting a linter running):
//   - `max-lines` / entropy + drift rules. The tripwire that would catch the
//     next AppShell, but switching it on the same day as the config buries the
//     signal under the current AppShell. Needs a ratchet baseline first.
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
    // This config file itself: ESM running under Node.
    files: ["eslint.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
);
