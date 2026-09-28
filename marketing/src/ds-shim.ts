// Bundler defines, supplied for the design-sync bundle.
//
// `__BUILD_YEAR__` is a Vite `define` (marketing/vite.config.ts) that Footer
// reads at module scope. Vite replaces it at build time; the design-sync
// converter bundles with esbuild and does not, so the identifier survives into
// the bundle and every component threw `ReferenceError: __BUILD_YEAR__ is not
// defined` on evaluation — which also emptied the bundle's exports, so all six
// components failed the validator's export smoke at once.
//
// Imported FIRST by ds-entry.ts: ESM evaluates imports in order, so this
// assignment runs before Footer's module body reads the constant.
//
// Assigned through a cast rather than `declare global`: vite-env.d.ts already
// declares `__BUILD_YEAR__` as an ambient `const`, so a second declaration is
// a redeclare error and the const itself cannot be assigned to.
(globalThis as Record<string, unknown>).__BUILD_YEAR__ ??= new Date().getFullYear();
export {};
