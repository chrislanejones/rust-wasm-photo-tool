import { Link } from "react-router-dom";

function ToolBtn({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] border ${
        active
          ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
          : "text-zinc-400 hover:bg-zinc-900 border-transparent"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-orange-400" : "bg-zinc-700"}`} />
      {label}
    </button>
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
          A browser-based photo studio that crops, filters, draws, and re-encodes
          on your own machine. Built in Rust, shipped as WASM — your pixels never
          leave the tab.
        </p>

        <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
          <a
            href="#cta"
            className="px-5 py-3 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white font-medium hover:opacity-90 transition glow"
          >
            Open the editor →
          </a>
          <Link
            to="/architecture"
            className="px-5 py-3 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-200 font-medium transition"
          >
            See the architecture
          </Link>
        </div>

        <div className="mt-10 flex items-center justify-center gap-6 text-xs text-zinc-500 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="text-emerald-400">●</span> No upload for demo</span>
          <span className="flex items-center gap-1.5"><span className="text-orange-400">●</span> ~200KB WASM bundle</span>
          <span className="flex items-center gap-1.5"><span className="text-violet-400">●</span> Real-time multi-device sync</span>
          <span className="flex items-center gap-1.5"><span className="text-pink-400">●</span> Export PNG · JPEG · WebP · AVIF</span>
        </div>

        {/* App mock */}
        <div className="mt-16 mx-auto max-w-5xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <span className="ml-3 text-[11px] text-zinc-500 mono">image-horse.app/edit</span>
            </div>
            <div className="grid grid-cols-12 h-[360px] sm:h-[420px]">
              <aside className="col-span-2 border-r border-zinc-800 bg-zinc-950 p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-600 px-1">Tools</div>
                <ToolBtn label="Crop" />
                <ToolBtn label="Brush" active />
                <ToolBtn label="Shapes" />
                <ToolBtn label="Text" />
                <ToolBtn label="Blur" />
                <ToolBtn label="Clone" />
              </aside>
              <div className="col-span-8 relative bg-[#1a1a1d] flex items-center justify-center overflow-hidden">
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 30% 40%, #f97316 0%, transparent 40%), radial-gradient(circle at 70% 70%, #ec4899 0%, transparent 35%)",
                  }}
                />
                <div className="relative rounded-xl border border-zinc-700/80 bg-zinc-800/30 w-72 h-48 flex items-center justify-center">
                  <img src="/Image-Horse-Logo.svg" alt="" className="w-20 h-20 opacity-80" />
                  <div className="absolute top-3 left-6 w-12 h-12 border-2 border-orange-400 rounded-sm" />
                  <div className="absolute bottom-3 right-6 px-1.5 py-0.5 text-[10px] rounded bg-pink-500/80 text-white">
                    label
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] text-zinc-500 mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> wasm ready · 100%
                </div>
              </div>
              <aside className="col-span-2 border-l border-zinc-800 bg-zinc-950 p-3 text-xs space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Layers</div>
                  <div className="space-y-1">
                    <div className="px-2 py-1 rounded bg-pink-500/10 border border-pink-500/30 text-pink-300 text-[11px]">
                      Annotations
                    </div>
                    <div className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-[11px]">
                      Base image
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Export</div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">PNG</span>
                    <span className="text-[10px] mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">JPEG</span>
                    <span className="text-[10px] mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">WebP</span>
                    <span className="text-[10px] mono px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">AVIF</span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
