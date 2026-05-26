function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="text-xs mono text-zinc-500 mb-2">{n}</div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section id="how" className="border-t border-zinc-900 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-wider text-orange-400 font-medium mb-2">How it works</div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Open. Edit. Export. That's it.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Step
            n="01"
            title="Drop an image"
            body="PNG, JPEG, WebP, AVIF. Up to your browser's memory limit. Nothing is sent anywhere — the WASM module loads on first interaction."
          />
          <Step
            n="02"
            title="Edit in real time"
            body="Annotate, filter, crop, retouch. Every action is a Rust function executed on your CPU through wasm-bindgen."
          />
          <Step
            n="03"
            title="Export or sync"
            body="Download in any format, or sign in to keep projects in Convex with live history and shareable links."
          />
        </div>
      </div>
    </section>
  );
}
