/// <reference types="vite/client" />

// The marketing site had no vite-env.d.ts, because until now nothing here read
// `import.meta.env` — main.tsx only mentions it in a comment. `lib/analytics.ts`
// is the first real use (PROD-gating gtag so local reloads never land in the
// live property), and without this reference tsc reports
// "Property 'env' does not exist on type 'ImportMeta'".
//
// This is Vite's own convention rather than a cast at the call site: the types
// come from the installed Vite version, so they stay correct across upgrades and
// every future `import.meta.env` read is covered without another local fix.

/** The year of the build, from `define` in vite.config.ts. */
declare const __BUILD_YEAR__: number;

interface ImportMetaEnv {
  /** Public Web3Forms key for /contact — see WEB3FORMS_KEY in config.ts. */
  readonly VITE_WEB3FORMS_KEY?: string;
}
