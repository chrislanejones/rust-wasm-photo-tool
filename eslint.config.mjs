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
    // This config file itself: ESM running under Node.
    files: ["eslint.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
);
