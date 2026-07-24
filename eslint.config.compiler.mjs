// PROBE CONFIG — the React Compiler rule set that eslint-plugin-react-hooks v7
// ships in `recommended` (17 rules, 14 of them error), which eslint.config.mjs
// deliberately does NOT enable. Used to drive the chore/react-compiler-rules
// pass. Run: npx eslint app/src --config eslint.config.compiler.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "pkg/**", "target/**", "**/*.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["app/src/**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs["recommended-latest"].rules,
  },
);
