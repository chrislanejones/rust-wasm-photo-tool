// Applies the user's theme preference to the document. The initial `.dark` class
// is set pre-paint by the inline guard in index.html (no FOUC); this hook keeps
// it in sync when the choice changes and — in "system" mode — tracks the OS
// color-scheme live. Resolution logic mirrors the index.html guard.
import { useEffect, useState } from "react";
import type { ThemeChoice } from "@/lib/preferences";

/** Browser-chrome <meta name="theme-color"> values per theme (match the bg). */
const DARK_BG = "#121212";
const LIGHT_BG = "#f3efe8";

/** Resolve a ThemeChoice to a concrete dark(true)/light(false). */
export function resolveDark(theme: ThemeChoice): boolean {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return theme === "dark";
}

/** Apply a resolved theme to <html>: `.dark` class, color-scheme, theme-color. */
function applyTheme(dark: boolean): void {
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? DARK_BG : LIGHT_BG);
}

/**
 * Keep the document theme in sync with `theme`. Re-applies on every change and,
 * for "system", subscribes to the OS color-scheme media query so the app tracks
 * a live OS switch without a reload.
 */
export function useTheme(theme: ThemeChoice): void {
  useEffect(() => {
    applyTheme(resolveDark(theme));
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
}

/**
 * Toggle the global `.reduce-motion` class on <html> from the user's preference.
 * Pairs with the CSS rule that near-zeroes transition/animation durations and a
 * `<MotionConfig reducedMotion="always">` wrapper that stops framer-motion's
 * transform animations — together they give an opted-out user a calm, near-static
 * UI. Pure DOM (not a Rust/WASM concern).
 */
export function useReduceMotion(on: boolean): void {
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", on);
  }, [on]);
}

/**
 * Reactive resolved theme ("dark" | "light") for third-party components that
 * can't read our CSS vars (Clerk, sonner, emoji-mart). Tracks the `.dark` class
 * on <html> — kept authoritative by useTheme for both manual and system changes,
 * and set pre-paint by index.html — so it's correct on first render and updates
 * live. Works regardless of where the component sits in the tree.
 */
export function useResolvedTheme(): "dark" | "light" {
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    sync(); // catch any change between initial state and effect run
    return () => obs.disconnect();
  }, []);
  return dark ? "dark" : "light";
}
