type Color = "orange" | "pink" | "emerald" | "violet" | "amber" | "blue";

const FEATURE_COLORS: Record<Color, { border: string; bg: string; text: string }> = {
  orange:  { border: "border-orange-500/30",  bg: "bg-orange-500/5",  text: "text-orange-400" },
  pink:    { border: "border-pink-500/30",    bg: "bg-pink-500/5",    text: "text-pink-400" },
  emerald: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", text: "text-emerald-400" },
  violet:  { border: "border-violet-500/30",  bg: "bg-violet-500/5",  text: "text-violet-400" },
  amber:   { border: "border-amber-500/30",   bg: "bg-amber-500/5",   text: "text-amber-400" },
  blue:    { border: "border-blue-500/30",    bg: "bg-blue-500/5",    text: "text-blue-400" },
};

function Feature({ color, title, body, tags }: {
  color: Color; title: string; body: string; tags: string;
}) {
  const c = FEATURE_COLORS[color];
  return (
    <article className={`flex flex-col h-full rounded-xl border ${c.border} ${c.bg} p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full bg-current ${c.text}`} />
        <h3 className="font-medium text-zinc-100">{title}</h3>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
      <div className={`mt-auto pt-3 text-[11px] mono ${c.text}`}>{tags}</div>
    </article>
  );
}

export default function Features() {
  return (
    <section id="features" className="border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-wider text-orange-400 font-medium mb-2">Features</div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Everything an image workflow needs, none of the upload tax.
          </h2>
          <p className="mt-3 text-zinc-400">
            Editing tools run locally in WebAssembly, so the demo is instant and
            free. Sign in only when you need persistence, sharing, or AI.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Feature color="orange"  title="WASM-powered editor"   body="Rust-compiled filters, transforms, and rasterization run at near-native speed on the visitor's CPU." tags="Brightness · Contrast · Blur · Crop · Resize" />
          <Feature color="pink"    title="Layered annotations"   body="Rectangles, ellipses, arrows, numbered callout pins, freehand pen strokes, text, and emoji — organized in real-layer stacks with locking and blend modes." tags="Rect · Ellipse · Arrow · Pin · Pen · Text" />
          <Feature color="emerald" title="Format conversion"     body="Encode and decode PNG, JPEG, WebP, and AVIF. Resize and re-compress in a single round-trip." tags="PNG · JPEG · WebP · AVIF" />
          <Feature color="amber"   title="Batch Image Editor"    body="Stamp a logo onto every photo in one pass, or browse the gallery as a 5×3 grid mosaic with the active photo as the hero tile. Compositing, scaling, and PNG encoding all run in Rust — zero canvas round-trips." tags="Bulk logo · Grid view · SVG logos · Rust composite" />
          <Feature color="violet"  title="AI enhancements"       body="Background removal is live via a Convex → Replicate pipeline; 4× upscaling, object removal, and alt-text generation are queued up next." tags="rembg (live) · Real-ESRGAN · SD Inpaint · BLIP" />
          <Feature color="blue"    title="Privacy by default"    body="Demo mode never uploads, and processing stays local on every tier. A per-export EXIF padlock lets you keep your camera metadata — GPS, capture time, lens — or strip it for privacy before an image ever leaves the tab." tags="No server processing · EXIF keep / strip" />
        </div>
      </div>
    </section>
  );
}
