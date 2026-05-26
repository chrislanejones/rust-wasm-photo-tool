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
    <article className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full bg-current ${c.text}`} />
        <h3 className="font-medium text-zinc-100">{title}</h3>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
      <div className={`mt-3 text-[11px] mono ${c.text}`}>{tags}</div>
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
          <Feature color="pink"    title="Layered annotations"   body="Rectangles, ellipses, arrows, paths, text, and emoji — organized in real-layer stacks with locking and blend modes." tags="Rect · Ellipse · Path · Text · Arrow" />
          <Feature color="emerald" title="Format conversion"     body="Encode and decode PNG, JPEG, WebP, and AVIF. Resize and re-compress in a single round-trip." tags="PNG · JPEG · WebP · AVIF" />
          <Feature color="violet"  title="AI enhancements"       body="Background removal, 4× upscaling, object removal, and alt-text generation, on-demand via Replicate." tags="rembg · Real-ESRGAN · SD Inpaint · BLIP" />
          <Feature color="amber"   title="Real-time projects"    body="Convex-backed projects sync edits, history, and shares across devices the moment you save." tags="Projects · History · Share links" />
          <Feature color="blue"    title="Privacy by default"    body="Demo mode never uploads. Even on the paid tier, processing stays local — uploads exist for sharing, not computation." tags="No server processing" />
        </div>
      </div>
    </section>
  );
}
