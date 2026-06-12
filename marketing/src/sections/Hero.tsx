import { EDITOR_URL } from "../config";

function CityCanvas() {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #27272a 25%, transparent 25%), linear-gradient(-45deg, #27272a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #27272a 75%), linear-gradient(-45deg, transparent 75%, #27272a 75%)",
          backgroundSize: "14px 14px",
          backgroundPosition: "0 0, 0 7px, 7px -7px, -7px 0",
        }}
      />
      <div className="absolute inset-3 rounded-sm overflow-hidden">
        <svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" className="w-full h-full block">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cfd9df" />
              <stop offset="55%" stopColor="#e9b88a" />
              <stop offset="85%" stopColor="#c98a5a" />
              <stop offset="100%" stopColor="#8a5a3a" />
            </linearGradient>
            <linearGradient id="orangeBldg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e07a45" />
              <stop offset="60%" stopColor="#b85a2c" />
              <stop offset="100%" stopColor="#7a3a1a" />
            </linearGradient>
            <linearGradient id="brickBldg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c98256" />
              <stop offset="100%" stopColor="#6e3a22" />
            </linearGradient>
            <linearGradient id="glassBldg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9aa4ac" />
              <stop offset="100%" stopColor="#4a5258" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="800" height="500" fill="url(#sky)" />
          <path d="M0 300 L80 250 L140 275 L210 220 L280 260 L360 215 L440 255 L520 225 L600 250 L680 220 L760 245 L800 235 L800 320 L0 320 Z" fill="#a89a8e" opacity="0.85" />
          <path d="M120 248 L150 240 L180 252 M250 230 L280 222 L310 240 M400 222 L430 215 L460 232 M560 235 L590 228 L620 245 M700 228 L725 222 L750 238" stroke="#f1ece6" strokeWidth="3" fill="none" strokeLinejoin="round" />
          <path d="M0 330 L120 295 L240 320 L360 290 L500 315 L640 290 L800 310 L800 360 L0 360 Z" fill="#7a6a5e" opacity="0.9" />
          <rect x="20" y="240" width="110" height="160" fill="#5a4a3e" />
          <rect x="135" y="265" width="60" height="135" fill="#6b5648" />
          <rect x="220" y="135" width="160" height="265" fill="url(#orangeBldg)" />
          <g fill="#3a2218" opacity="0.55">
            {Array.from({ length: 13 }).map((_, row) =>
              Array.from({ length: 7 }).map((_, col) => (
                <rect key={`o-${row}-${col}`} x={232 + col * 21} y={150 + row * 19} width="13" height="11" />
              ))
            )}
          </g>
          <rect x="220" y="135" width="14" height="265" fill="#ffb074" opacity="0.35" />
          <rect x="395" y="225" width="70" height="175" fill="#d8c9b8" />
          <rect x="395" y="225" width="70" height="20" fill="#efe4d3" />
          <rect x="475" y="170" width="120" height="230" fill="url(#brickBldg)" />
          <g fill="#2e1a10" opacity="0.55">
            {Array.from({ length: 11 }).map((_, row) =>
              Array.from({ length: 5 }).map((_, col) => (
                <rect key={`b-${row}-${col}`} x={485 + col * 22} y={185 + row * 19} width="14" height="11" />
              ))
            )}
          </g>
          <rect x="605" y="200" width="95" height="200" fill="url(#glassBldg)" />
          <g fill="#1f262b" opacity="0.6">
            {Array.from({ length: 10 }).map((_, row) =>
              Array.from({ length: 5 }).map((_, col) => (
                <rect key={`g-${row}-${col}`} x={613 + col * 17} y={212 + row * 18} width="11" height="11" />
              ))
            )}
          </g>
          <rect x="710" y="260" width="80" height="140" fill="#7a5a44" />
          <g fill="#1e1a16" opacity="0.85">
            {Array.from({ length: 26 }).map((_, i) => (
              <circle key={`t-${i}`} cx={20 + i * 30} cy={400} r={10 + (i % 3) * 2} />
            ))}
          </g>
          <rect x="0" y="408" width="800" height="92" fill="#1a1715" />
          <g fill="#3a3633">
            {Array.from({ length: 18 }).map((_, i) => (
              <rect key={`c-${i}`} x={15 + i * 43} y={440 + (i % 2) * 14} width="32" height="11" rx="2" />
            ))}
          </g>
          <g fill="#c9c4bd" opacity="0.5">
            <rect x="120" y="442" width="32" height="11" rx="2" />
            <rect x="380" y="458" width="32" height="11" rx="2" />
            <rect x="610" y="442" width="32" height="11" rx="2" />
          </g>
        </svg>
      </div>
    </div>
  );
}

type IconName =
  | "shrink"
  | "crop"
  | "paintbrush"
  | "type"
  | "fileText"
  | "brain"
  | "shapes"
  | "sparkles"
  | "stamp"
  | "images";

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "shrink":
      return (
        <svg {...common}>
          <path d="m15 15 6 6" />
          <path d="m15 9 6-6" />
          <path d="M21 16.2V21h-4.8" />
          <path d="M21 7.8V3h-4.8" />
          <path d="M3 16.2V21h4.8" />
          <path d="m3 21 6-6" />
          <path d="M3 7.8V3h4.8" />
          <path d="M9 9 3 3" />
        </svg>
      );
    case "crop":
      return (
        <svg {...common}>
          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </svg>
      );
    case "paintbrush":
      return (
        <svg {...common}>
          <path d="m14.622 17.897-10.68-2.913" />
          <path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z" />
          <path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15" />
        </svg>
      );
    case "type":
      return (
        <svg {...common}>
          <path d="M12 4v16" />
          <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
          <path d="M9 20h6" />
        </svg>
      );
    case "fileText":
      return (
        <svg {...common}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>
      );
    case "brain":
      return (
        <svg {...common}>
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
          <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
        </svg>
      );
    case "shapes":
      return (
        <svg {...common}>
          <path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <circle cx="17.5" cy="17.5" r="3.5" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common}>
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          <path d="M20 3v4" />
          <path d="M22 5h-4" />
          <path d="M4 17v2" />
          <path d="M5 18H3" />
        </svg>
      );
    case "stamp":
      return (
        <svg {...common}>
          <path d="M5 22h14" />
          <path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77Z" />
          <path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-3-3c-1.66 0-3 1-3 3s1 1.5 1 3.5V13" />
        </svg>
      );
    case "images":
      return (
        <svg {...common}>
          <path d="M18 22H4a2 2 0 0 1-2-2V6" />
          <path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" />
          <circle cx="12" cy="8" r="2" />
          <rect width="16" height="16" x="6" y="2" rx="2" />
        </svg>
      );
  }
}

const TOOL_ICONS: Array<{ name: IconName; gradient: string; active?: boolean }> = [
  { name: "shrink", gradient: "from-orange-500 to-red-500", active: true },
  { name: "crop", gradient: "from-orange-400 to-amber-500" },
  { name: "paintbrush", gradient: "from-sky-400 to-blue-500" },
  { name: "type", gradient: "from-blue-500 to-indigo-600" },
  { name: "fileText", gradient: "from-emerald-500 to-teal-500" },
  { name: "brain", gradient: "from-violet-500 to-purple-600" },
  { name: "shapes", gradient: "from-pink-500 to-rose-500" },
  { name: "sparkles", gradient: "from-fuchsia-500 to-violet-500" },
  { name: "stamp", gradient: "from-rose-500 to-red-600" },
  { name: "images", gradient: "from-amber-400 to-orange-500" },
];

function ToolIcon({ name, gradient, active }: { name: IconName; gradient: string; active?: boolean }) {
  return (
    <div
      className={`aspect-square rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg shadow-black/30 ${
        active ? "ring-2 ring-white/90 ring-offset-2 ring-offset-zinc-950" : ""
      }`}
    >
      <Icon name={name} />
    </div>
  );
}

function TopTabs() {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/80">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
        <button className="px-1.5 py-0.5 rounded hover:bg-zinc-800">−</button>
        <span className="mono text-zinc-300">100%</span>
        <button className="px-1.5 py-0.5 rounded hover:bg-zinc-800">+</button>
      </div>
      <div className="flex items-center gap-1 text-[10px]">
        <span className="px-2 py-0.5 rounded text-zinc-400">↑ Upload</span>
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-100 font-medium">🔧 Tools</span>
        <span className="px-2 py-0.5 rounded text-zinc-400">🖼 Gallery</span>
        <span className="px-2 py-0.5 rounded text-zinc-400">⏱ History</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 mono">JPEG ▾</span>
        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-rose-300">🗑 Delete</span>
        <span className="w-4 h-4 rounded-full bg-zinc-700" />
      </div>
    </div>
  );
}

function Bar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] text-zinc-500 uppercase tracking-wider mb-1">
        <span>{label}</span>
        <span className="text-zinc-300 mono">{value}</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ResizePanel() {
  return (
    <aside className="col-span-3 border-l border-zinc-800 bg-zinc-950 p-3 text-[10px] space-y-3 overflow-hidden">
      <div className="text-[9px] uppercase tracking-wider text-zinc-500">Resize & Compress</div>
      <Bar label="Performance Gain" value="+25%" pct={25} color="bg-rose-500" />
      <Bar label="Lighthouse Score" value="63%" pct={63} color="bg-amber-500" />
      <div>
        <div className="flex items-center justify-between text-[9px] text-zinc-500 uppercase tracking-wider mb-1">
          <span>Quality</span>
          <span className="text-zinc-300 mono">75%</span>
        </div>
        <div className="relative h-1 rounded-full bg-zinc-800">
          <div className="absolute inset-y-0 left-0 w-3/4 rounded-full bg-zinc-400" />
          <div className="absolute top-1/2 left-3/4 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow" />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] uppercase tracking-wider text-zinc-500">Dimensions</span>
          <span className="text-[9px] text-amber-400">Lock</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-1">
            <div className="text-[8px] text-zinc-600 leading-none">width</div>
            <div className="text-zinc-300 mono leading-tight">2048</div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-1">
            <div className="text-[8px] text-zinc-600 leading-none">height</div>
            <div className="text-zinc-300 mono leading-tight">1536</div>
          </div>
        </div>
      </div>
      <button className="w-full text-[10px] text-zinc-500 border border-dashed border-zinc-700 rounded py-1">Show A/B compare</button>
      <div className="space-y-1.5 pt-1">
        <button className="w-full text-[10px] bg-zinc-800 text-zinc-200 rounded py-1.5">Apply Resize & Quality</button>
        <button className="w-full text-[10px] bg-zinc-800 text-zinc-300 rounded py-1.5">⚡ Auto Compress All</button>
        <div className="grid grid-cols-2 gap-1.5">
          <button className="text-[10px] bg-zinc-800 text-zinc-300 rounded py-1.5">↓ JPEG</button>
          <button className="text-[10px] bg-zinc-800 text-zinc-300 rounded py-1.5">↓ All</button>
        </div>
      </div>
    </aside>
  );
}

function GalleryStrip() {
  const swatches = [
    "linear-gradient(135deg,#8a6b50,#3a2820)",
    "linear-gradient(135deg,#c25c3a,#5d2a18)",
    "linear-gradient(135deg,#6a584a,#2a1f18)",
    "linear-gradient(135deg,#a07868,#3a2820)",
    "linear-gradient(135deg,#3e4a52,#1a2026)",
    "linear-gradient(135deg,#5a4e44,#26201a)",
    "linear-gradient(135deg,#7a6050,#2e2218)",
    "linear-gradient(135deg,#365062,#152028)",
    "linear-gradient(135deg,#284060,#0e1a2a)",
    "linear-gradient(135deg,#385c3e,#13241a)",
  ];
  return (
    <div className="border-t border-zinc-800 bg-zinc-950 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] text-zinc-400">🖼 Gallery</span>
        <span className="text-[10px] text-zinc-600">(12)</span>
      </div>
      <div className="flex items-center gap-1.5 overflow-hidden">
        {swatches.map((bg, i) => (
          <div key={i} className={`shrink-0 w-12 h-9 rounded-sm ${i === 1 ? "ring-2 ring-orange-400" : ""}`} style={{ background: bg }} />
        ))}
      </div>
    </div>
  );
}

function StatusBarMock() {
  return (
    <div className="flex items-center justify-between px-3 py-1 border-t border-zinc-800 bg-zinc-950 text-[9px] text-zinc-500">
      <div className="flex items-center gap-2">
        <span className="text-zinc-300">🐴 Image Horse</span>
        <span className="text-zinc-700">|</span>
        <span>Demo mode</span>
      </div>
      <div className="hidden sm:flex items-center gap-2 mono">
        <span>Ctrl+Z undo</span>
        <span className="text-zinc-700">·</span>
        <span>Space pan</span>
        <span className="text-zinc-700">·</span>
        <span>Alt+? shortcuts</span>
      </div>
      <div className="flex items-center gap-2 mono">
        <span>12 imgs</span>
        <span className="text-zinc-700">·</span>
        <span>2048×1536</span>
        <span className="text-zinc-700">·</span>
        <span className="text-orange-400">v0.9.7</span>
      </div>
    </div>
  );
}

function AppMockup() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        <span className="ml-3 text-[11px] text-zinc-500 mono">rust-wasm-photo-tool.netlify.app</span>
      </div>
      <TopTabs />
      <div className="grid grid-cols-12 h-[380px] sm:h-[440px]">
        <aside className="col-span-2 border-r border-zinc-800 bg-zinc-950 p-3">
          <div className="grid grid-cols-2 gap-2.5">
            {TOOL_ICONS.map((t, i) => (
              <ToolIcon key={i} {...t} />
            ))}
          </div>
        </aside>
        <div className="col-span-7 relative bg-[#161618]">
          <CityCanvas />
        </div>
        <ResizePanel />
      </div>
      <GalleryStrip />
      <StatusBarMock />
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
          Convert and annotate images <span className="gradient-text">at native speed</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          A browser-based photo studio that crops, filters, draws, and re-encodes on your own machine. Built in Rust, shipped as WASM — your pixels never leave the tab.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
          <a href={EDITOR_URL} target="_blank" rel="noopener noreferrer" className="px-5 py-3 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white font-medium hover:opacity-90 transition glow">
            Beta Version →
          </a>
        </div>
        <div className="mt-10 flex items-center justify-center gap-6 text-xs text-zinc-500 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="text-emerald-400">●</span> No upload for demo</span>
          <span className="flex items-center gap-1.5"><span className="text-orange-400">●</span> ~200KB WASM bundle</span>
          <span className="flex items-center gap-1.5"><span className="text-violet-400">●</span> Real-time multi-device sync</span>
          <span className="flex items-center gap-1.5"><span className="text-pink-400">●</span> Export PNG · JPEG · WebP · AVIF</span>
        </div>
        <div className="mt-16 mx-auto max-w-5xl text-left">
          <AppMockup />
        </div>
      </div>
    </section>
  );
}
