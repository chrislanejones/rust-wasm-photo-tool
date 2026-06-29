import { EDITOR_URL } from "../config";

function AppMockup() {
  // The screenshot already shows the full app UI, so the hero is just the
  // image in a framed card — no surrounding mock browser chrome.
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-2xl overflow-hidden">
      <img
        src="/Rust-Wasm-Photo-Tool-App-June-2.webp"
        alt="Image Horse — Rust + WASM photo editor in the browser"
        className="w-full block"
      />
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-grid" />
      <div className="absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-orange-500/10 via-pink-500/5 to-transparent pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-xs text-orange-300 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          v2.0 — Now powered by Rust + WebAssembly
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight max-w-4xl mx-auto leading-[1.05]">
          Convert and annotate images{" "}
          <span className="gradient-text">at native speed</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          A browser-based photo studio — crop, filter, draw, annotate, and
          re-encode on your own machine. Built in Rust, shipped as WebAssembly,
          with a layered editor and an instant local gallery — your pixels never
          leave the tab.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
          <a
            href={EDITOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white font-medium hover:opacity-90 transition glow"
          >
            Beta Version
          </a>
        </div>
        <div className="mt-10 flex items-center justify-center gap-6 text-xs text-zinc-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-400">●</span> No upload for demo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-orange-400">●</span> ~200KB WASM bundle
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-violet-400">●</span> Real-time multi-device
            sync
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-pink-400">●</span> Export PNG · JPEG · WebP ·
            AVIF
          </span>
        </div>
        <div className="mt-16 mx-auto max-w-5xl">
          <AppMockup />
        </div>
      </div>
    </section>
  );
}
