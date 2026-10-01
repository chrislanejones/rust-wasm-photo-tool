// Test harness globals for the persistence tests.
//
// `fake-indexeddb/auto` installs an in-memory `indexedDB` + `IDBKeyRange` onto
// globalThis so both the raw-IndexedDB legacy store and Dexie run unchanged.
// Each test file gets a fresh in-memory DB via `IDBFactory` reset in beforeEach
// (see the specs). Node 25 already provides `crypto.subtle`, `Blob`, and
// `structuredClone`; we only polyfill `URL.createObjectURL`/`revokeObjectURL`,
// which Node does not expose as globals and which a couple of helpers touch.
import "fake-indexeddb/auto";

if (typeof URL.createObjectURL !== "function") {
  let n = 0;
  // Minimal stub: the adapter tests never dereference the URL, they only check
  // that a non-null string is produced from a stored blob.
  URL.createObjectURL = () => `blob:fake/${n++}`;
  URL.revokeObjectURL = () => {};
}

// ── DOM-only setup, for files that opt into jsdom ──────────────────────────
//
// Guarded on `document` because this same setup file runs for the ~139
// node-environment tests, where importing a DOM testing library throws.
if (typeof document !== "undefined") {
  // framer-motion's reduced-motion check reads matchMedia on import, and jsdom
  // has none. Returning a non-matching query means "motion allowed", which is
  // the state the panels are designed in; a file that needs Reduce Motion
  // overrides this itself.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }

  // jsdom has no ResizeObserver, and several primitives construct one.
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // Testing Library's automatic cleanup hooks `afterEach` off the GLOBAL
  // scope, and this project runs with `globals: false` — so it never
  // registers and every render leaks into the next test. Wiring it here keeps
  // each component file from having to remember.
  const { afterEach } = await import("vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());
}
