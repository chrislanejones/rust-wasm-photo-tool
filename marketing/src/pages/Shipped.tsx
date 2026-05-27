import { Link } from "react-router-dom";
import { EDITOR_URL } from "../config";

type Tag = "feature" | "perf" | "fix" | "rust" | "ui" | "infra" | "mock";

const TAG_COLORS: Record<Tag, string> = {
  feature: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  perf:    "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  fix:     "border-rose-500/40 bg-rose-500/10 text-rose-300",
  rust:    "border-amber-500/40 bg-amber-500/10 text-amber-300",
  ui:      "border-violet-500/40 bg-violet-500/10 text-violet-300",
  infra:   "border-blue-500/40 bg-blue-500/10 text-blue-300",
  mock:    "border-zinc-600/40 bg-zinc-800/60 text-zinc-400",
};

interface Entry {
  text: string;
  tag: Tag;
}

interface Release {
  version: string;
  date: string;
  headline: string;
  entries: Entry[];
}

const RELEASES: Release[] = [
  {
    version: "v0.9.7",
    date: "2026-05",
    headline: "Batch Image Editor + grid mosaic",
    entries: [
      { tag: "feature", text: "Batch Image Editor — tool renamed from \"Images\"; real panel with Logo / Text tab toggle and a grid mosaic of the gallery." },
      { tag: "feature", text: "Bulk logo stamp — pick a PNG/JPG/WebP/SVG, choose corner + size + opacity + margin, apply to every photo in one pass. Active photo gets an undo entry; others persist directly to IDB." },
      { tag: "feature", text: "SVG logo support — rasterized via <img> + OffscreenCanvas with a 512×512 fallback when the SVG omits intrinsic dimensions." },
      { tag: "mock",    text: "Batch Text overlay — mock UI in place (textarea, font, color, position, opacity); apply button shows a Coming Soon badge." },
      { tag: "feature", text: "Grid canvas mode — when Batch Image Editor is active, the canvas becomes a 5×3 mosaic; selected photo is a 2×2 hero tile, surrounded by up to 11 clickable thumbnails. Caps at 12 visible with a +N more badge." },
      { tag: "ui",      text: "Selected indicator — orange ring + pill badge on the hero tile; placeholder overlay shows when no photo is loaded." },
      { tag: "fix",     text: "Auto-select first photo — keeps the hero populated after session restore or photo deletion." },
      { tag: "fix",     text: "Canvas survives container resize — flushToCanvas re-blits the WASM buffer via a ResizeObserver. Fixes the blank-hero bug when switching tools." },
      { tag: "rust",    text: "composite_pixels — stateless RGBA alpha-compositing exposed as a free wasm-bindgen function." },
      { tag: "rust",    text: "resize_pixels — stateless bilinear resize. Batch logo scaling moves from OffscreenCanvas to Rust." },
      { tag: "rust",    text: "encode_png_pixels — stateless PNG encoding. Batched photo outputs skip canvas.convertToBlob entirely." },
      { tag: "ui",      text: "Marketing link in upload dialog footer; darker .checkerboard-dark variant for the grid surround." },
    ],
  },
  {
    version: "v0.9.6",
    date: "2026-04",
    headline: "Image Horse rename + originals store",
    entries: [
      { tag: "feature", text: "App renamed Image Horse — was Clone Stamp App; WASM struct renamed CloneStampTool → ImageHorseTool." },
      { tag: "feature", text: "Content-addressed originals — SHA-256-keyed IndexedDB store; originals survive photo switching and page reload at full resolution." },
      { tag: "perf",    text: "Working copies — uploads downscaled to ≤2048px long edge via createImageBitmap; 256px WebP thumbnails generated in parallel." },
      { tag: "fix",     text: "CompareSlider alignment — overlay tracks the canvas bounding box via ResizeObserver; before/after layers share one coordinate space through zoom and pan." },
      { tag: "perf",    text: "Compare URL on demand — originalUrl populated only when compare activates; revoked on cleanup." },
      { tag: "ui",      text: "Apply Resize and Quality — button renamed; disabled until width, height, or quality actually changes." },
    ],
  },
  {
    version: "v0.9.5",
    date: "2026-03",
    headline: "Text rotation + Convex archive format",
    entries: [
      { tag: "feature", text: "Text rotate handle — SVG rotate circle above the text box; drag to rotate before committing." },
      { tag: "ui",      text: "ColorSwatchGrid — shared color swatch grid used across brush, text, arrow, and shape settings." },
      { tag: "ui",      text: "StatusBar auth mode — shows Demo or Signed In badge based on Clerk state." },
      { tag: "perf",    text: "Binary archive format for Convex edit history — canvas + undo/redo stack serialized as a compact binary archive instead of per-snapshot file uploads." },
      { tag: "infra",   text: "session_edits Convex table — 3-day expiry cron cleans up stale edits automatically." },
    ],
  },
  {
    version: "v0.9.4",
    date: "2026-02",
    headline: "Tabbed tool panels",
    entries: [
      { tag: "ui",      text: "Stamp tool — 3-tab panel (Clone / Stamps / Emojis); emojis tab houses the full @emoji-mart picker." },
      { tag: "feature", text: "Emoji tool → Images — toolbar tool renamed (now Batch Image Editor in v0.9.7)." },
      { tag: "ui",      text: "Shapes tool — Shapes / Arrows tab switcher; Arrows tab now shows full arrow settings." },
      { tag: "infra",   text: "Dual persistence — useEditPersistence routes canvas saves to Convex file storage (signed in) or IndexedDB (anonymous); useRecentTexts mirrors the same pattern." },
    ],
  },
  {
    version: "v0.9.3",
    date: "2026-01",
    headline: "Color picker + font family",
    entries: [
      { tag: "feature", text: "Brush tool split into Paint / Blur Brush tabs; canvas mouse routing controlled by sub-mode." },
      { tag: "feature", text: "Effects tool — Levels (brightness/contrast) and Color Picker tabs." },
      { tag: "feature", text: "Color picker pixel magnifier — WASM get_pixel_region returns 11×11 RGBA grid; floating canvas magnifier follows the cursor." },
      { tag: "feature", text: "Font family selector — 12 browser-safe fonts; applied to the canvas text overlay, persisted in TextMemory so re-editing restores it." },
      { tag: "feature", text: "Export All shortcut — Alt + Shift + E triggers ZIP export of all photos." },
    ],
  },
  {
    version: "v0.9.2",
    date: "2025-12",
    headline: "Per-photo persistence + Netlify fix",
    entries: [
      { tag: "feature", text: "Per-photo edit persistence — full WASM canvas + undo/redo stack saved to IndexedDB (PNG-encoded per snapshot) when switching photos. Switching back restores the exact session." },
      { tag: "fix",     text: "Clone stamp alpha compositing — Porter-Duff source-over; stroke_src_data frozen buffer prevents feedback artifacts." },
      { tag: "perf",    text: "Paint dab compositing — squared-distance circle rejection replaces sqrt in the hot loop." },
      { tag: "fix",     text: "Crop OOB clamp — boundary guard prevents out-of-bounds read on zero-area crops." },
      { tag: "fix",     text: "Netlify build fix — removed --out-dir from wasm-pack; app/pkg is a symlink." },
      { tag: "fix",     text: "Modified-photo dot — race condition fixed; dot only appears after actual brush/tool edits." },
    ],
  },
  {
    version: "v0.9.1",
    date: "2025-11",
    headline: "Convex schema + pan/zoom polish",
    entries: [
      { tag: "infra",   text: "Convex DB + auth schema — userProfiles, projects, images, layers, annotations, history, ai_jobs, subscriptions tables defined." },
      { tag: "feature", text: "Spacebar pan — Photoshop-style hand tool; all tool handlers bypassed during pan." },
      { tag: "feature", text: "Alt+Scroll zoom — composes with pan offset; listener moved to window for reliable mounting." },
      { tag: "feature", text: "PgUp / PgDn — cycle through gallery photos." },
      { tag: "ui",      text: "Blur Brush moved into the Effects panel alongside brightness + contrast." },
      { tag: "feature", text: "Crop SVG overlay — rule-of-thirds guides and 8 draggable resize handles." },
    ],
  },
];

function TagPill({ tag }: { tag: Tag }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TAG_COLORS[tag]}`}
    >
      {tag}
    </span>
  );
}

function ReleaseCard({ release, isLatest }: { release: Release; isLatest: boolean }) {
  return (
    <article className="relative">
      {/* timeline dot */}
      <div
        className={`absolute -left-[9px] top-2 w-4 h-4 rounded-full border-2 ${
          isLatest
            ? "border-orange-400 bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
            : "border-zinc-700 bg-zinc-900"
        }`}
      />

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 ml-2">
        <div className="flex items-baseline justify-between gap-4 mb-1 flex-wrap">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold text-zinc-100 mono">{release.version}</h3>
            {isLatest && (
              <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-300">
                Latest
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-500 mono">{release.date}</span>
        </div>
        <p className="text-sm text-zinc-400 mb-5">{release.headline}</p>

        <ul className="space-y-2.5">
          {release.entries.map((e, i) => (
            <li key={i} className="flex items-start gap-3">
              <TagPill tag={e.tag} />
              <span className="text-[13px] text-zinc-300 leading-relaxed flex-1">{e.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default function Shipped() {
  return (
    <section className="relative">
      <div className="absolute inset-x-0 top-0 h-[400px] bg-gradient-to-b from-orange-500/10 via-pink-500/5 to-transparent pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-24">
        <div className="mb-12">
          <div className="text-xs uppercase tracking-wider text-orange-400 font-medium mb-2">
            Shipped
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
            What's new in <span className="gradient-text">Image Horse</span>
          </h1>
          <p className="mt-4 text-zinc-400 max-w-2xl leading-relaxed">
            A running log of features, performance work, and fixes. Newest at the top.
            Click any release version to jump to the live editor and try the latest build.
          </p>
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <a
              href={EDITOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white text-sm font-medium hover:opacity-90 transition glow"
            >
              Try the latest →
            </a>
            <Link
              to="/architecture"
              className="px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-sm font-medium transition"
            >
              See the architecture
            </Link>
          </div>
        </div>

        {/* timeline rail */}
        <div className="relative pl-6 border-l-2 border-zinc-800 space-y-6">
          {RELEASES.map((release, i) => (
            <ReleaseCard key={release.version} release={release} isLatest={i === 0} />
          ))}
        </div>

        {/* legend */}
        <div className="mt-12 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Legend</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TAG_COLORS) as Tag[]).map((t) => (
              <div key={t} className="flex items-center gap-2">
                <TagPill tag={t} />
                <span className="text-[11px] text-zinc-500">
                  {t === "feature" && "new capability"}
                  {t === "perf" && "speed / memory"}
                  {t === "fix" && "bug fix"}
                  {t === "rust" && "WASM / Rust"}
                  {t === "ui" && "interface polish"}
                  {t === "infra" && "data / build"}
                  {t === "mock" && "UI only, not wired"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
