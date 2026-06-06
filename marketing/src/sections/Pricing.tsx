type PlanColor = "zinc" | "emerald" | "violet";

const PLAN_COLORS: Record<PlanColor, { border: string; text: string }> = {
  zinc:    { border: "border-zinc-700",       text: "text-zinc-400" },
  emerald: { border: "border-emerald-500/40", text: "text-emerald-400" },
  violet:  { border: "border-violet-500/60",  text: "text-violet-400" },
};

function PlanCard({
  tier, tag, price, sub, features, color, highlight = false, cta,
}: {
  tier: string;
  tag: string;
  price: string;
  sub: string;
  features: string[];
  color: PlanColor;
  highlight?: boolean;
  cta: string;
}) {
  const c = PLAN_COLORS[color];
  return (
    <div
      className={`rounded-xl border ${c.border} ${
        highlight ? "bg-violet-500/5 ring-2 ring-violet-500/40" : "bg-zinc-900/40"
      } p-6 relative`}
    >
      {highlight && (
        <div className="absolute -top-2.5 right-4 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500 text-white">
          Most popular
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-zinc-100 text-lg">{tier}</div>
        <div className={`text-[10px] uppercase tracking-wider ${c.text}`}>{tag}</div>
      </div>
      <div className="flex items-baseline gap-1 mb-5">
        <div className="text-4xl font-semibold text-zinc-100">{price}</div>
        <div className="text-xs text-zinc-500">{sub}</div>
      </div>
      <ul className="space-y-2 mb-5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
            <span className={`${c.text} mt-1.5`}>●</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href="#cta"
        className={`block text-center text-sm font-medium px-3 py-2 rounded-md transition ${
          highlight
            ? "bg-violet-500 hover:bg-violet-400 text-white"
            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
        }`}
      >
        {cta}
      </a>
    </div>
  );
}

function TierCategory({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-4 bg-zinc-800/50 border-t border-zinc-700">
      <div className="col-span-4 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </div>
    </div>
  );
}

function cellClass(value: string, italic = false, bold = false) {
  if (value === "yes" || value === "unlimited") return "text-emerald-400 font-medium";
  if (value === "—") return "text-zinc-600";
  if (
    value.includes("/day") ||
    value.includes("images") ||
    value.includes("MB") ||
    value.includes("GB") ||
    value.includes("projects") ||
    value.includes("per image") ||
    value.includes("active")
  ) return "text-amber-400";
  if (value.startsWith("$") || value.startsWith("~$"))
    return italic ? "text-zinc-500 italic" : bold ? "text-zinc-200 font-medium" : "text-zinc-400";
  return "text-zinc-300";
}

function TierRow({
  feature, sub, demo, free, pro, italic = false, bold = false,
}: {
  feature: string;
  sub?: string;
  demo: string;
  free: string;
  pro: string;
  italic?: boolean;
  bold?: boolean;
}) {
  return (
    <div className={`grid grid-cols-4 border-t border-zinc-800 text-[12px] ${bold ? "bg-zinc-800/30" : ""}`}>
      <div className="px-3 py-1.5 border-r border-zinc-800">
        <span className={`text-zinc-300 ${bold ? "font-medium" : ""}`}>{feature}</span>
        {sub && <span className="block text-[10px] text-zinc-500 mt-0.5">{sub}</span>}
      </div>
      <div className={`px-3 py-1.5 border-r border-zinc-800 text-center ${cellClass(demo, italic, bold)}`}>{demo}</div>
      <div className={`px-3 py-1.5 border-r border-zinc-800 text-center ${cellClass(free, italic, bold)}`}>{free}</div>
      <div className={`px-3 py-1.5 text-center ${cellClass(pro, italic, bold)}`}>{pro}</div>
    </div>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-xs">💡</div>
          <div>
            <div className="text-xs uppercase tracking-wider text-cyan-400 font-medium">Pricing</div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-100">Tier strategy & access matrix</h2>
            <p className="text-sm text-zinc-500 mt-1">Gate where money flows, not where CPU runs</p>
          </div>
        </div>

        {/* Core insight */}
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 mb-8">
          <div className="text-cyan-400 text-sm font-medium mb-2">🎯 Core insight</div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            WASM editing tools cost <span className="text-emerald-400 font-semibold">exactly zero per user</span> — they run on the visitor's CPU.
            Demo mode lets people use <span className="text-cyan-300">every editing tool freely</span>. That's the hook.
            Gates only exist where our money flows: <span className="text-pink-400">Convex writes</span>, <span className="text-amber-400">UploadThing storage</span>, and <span className="text-violet-400">Replicate inference</span>.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <PlanCard
            tier="Demo" tag="anonymous" price="$0" sub="forever" color="zinc" cta="Try it now"
            features={["All WASM tools", "12 image gallery", "Session-only", "No signup"]}
          />
          <PlanCard
            tier="Free" tag="logged in" price="$0" sub="per month" color="emerald" cta="Create account"
            features={["Persistence", "24 images", "3 projects", "100 MB", "5 AI runs / day"]}
          />
          <PlanCard
            tier="Pro" tag="best value" price="$10" sub="per month" color="violet" highlight cta="Start Pro"
            features={["100 photos (coming soon)", "Unlimited storage", "Unlimited layers", "4× upscale", "Object removal", "AI unlimited"]}
          />
        </div>

        {/* Matrix */}
        <div className="rounded-lg border border-zinc-700 overflow-hidden">
          <div className="grid grid-cols-4 bg-zinc-800/80 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            <div className="px-3 py-2 border-r border-zinc-700">Feature</div>
            <div className="px-3 py-2 border-r border-zinc-700 text-center">
              <span className="inline-block px-2 py-0.5 rounded bg-zinc-700 text-zinc-300 text-[9px] font-medium">Demo</span>
              <div className="text-[9px] font-normal normal-case tracking-normal mt-0.5 text-zinc-500">anonymous</div>
            </div>
            <div className="px-3 py-2 border-r border-zinc-700 text-center">
              <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-medium">Free</span>
              <div className="text-[9px] font-normal normal-case tracking-normal mt-0.5 text-zinc-500">logged in</div>
            </div>
            <div className="px-3 py-2 text-center">
              <span className="inline-block px-2 py-0.5 rounded bg-violet-500/20 text-violet-400 text-[9px] font-medium">Pro</span>
              <div className="text-[9px] font-normal normal-case tracking-normal mt-0.5 text-zinc-500">$10/mo</div>
            </div>
          </div>

          <TierCategory label="Editing tools (WASM — zero server cost)" />
          <TierRow feature="Clone stamp" demo="yes" free="yes" pro="yes" />
          <TierRow feature="Paint / brush" demo="yes" free="yes" pro="yes" />
          <TierRow feature="Arrows, shapes, text, emoji" demo="yes" free="yes" pro="yes" />
          <TierRow feature="Blur brush" demo="yes" free="yes" pro="yes" />
          <TierRow feature="Brightness / contrast" demo="yes" free="yes" pro="yes" />
          <TierRow feature="Crop / resize" demo="yes" free="yes" pro="yes" />
          <TierRow feature="Undo / redo (50 steps)" demo="yes" free="yes" pro="yes" />
          <TierRow feature="Export (PNG/JPEG/WebP/AVIF)" demo="yes" free="yes" pro="yes" />

          <TierCategory label="Gallery & storage" />
          <TierRow feature="Gallery" sub="photos loaded in session" demo="12 images" free="24 images" pro="100 (soon)" />
          <TierRow feature="Auto compress all" demo="yes" free="yes" pro="yes" />
          <TierRow feature="Image persistence" sub="saved across sessions" demo="—" free="UploadThing" pro="UploadThing" />
          <TierRow feature="File storage quota" demo="—" free="100 MB" pro="5 GB" />

          <TierCategory label="Projects & data (Convex)" />
          <TierRow feature="Projects" sub="organize into folders" demo="—" free="3 projects" pro="unlimited" />
          <TierRow feature="Persistent history" sub="edit history saved" demo="—" free="yes" pro="yes" />
          <TierRow feature="Annotations sync" sub="shapes recoverable" demo="—" free="yes" pro="yes" />
          <TierRow feature="Layers" demo="—" free="3 per image" pro="unlimited" />
          <TierRow feature="Share links" sub="public project URLs" demo="—" free="1 active" pro="unlimited" />

          <TierCategory label="AI features (Replicate — costs us money)" />
          <TierRow feature="Background removal" sub="rembg" demo="—" free="5/day" pro="unlimited" />
          <TierRow feature="Auto alt text" sub="BLIP captioning" demo="—" free="5/day" pro="unlimited" />
          <TierRow feature="4× upscale" sub="Real-ESRGAN" demo="—" free="—" pro="unlimited" />
          <TierRow feature="Object removal" sub="SD Inpaint" demo="—" free="—" pro="unlimited" />
          <TierRow feature="Smart crop" demo="—" free="—" pro="unlimited" />
          <TierRow feature="Auto-enhance" sub="histogram optimization (WASM)" demo="—" free="yes" pro="yes" />

          <TierCategory label="Our server cost per user" />
          <TierRow feature="Convex"       demo="$0" free="~$0.01/mo" pro="~$0.05/mo" italic />
          <TierRow feature="UploadThing"  demo="$0" free="~$0.02/mo" pro="~$0.10/mo" italic />
          <TierRow feature="Replicate AI" demo="$0" free="~$0.05/mo" pro="~$0.30/mo" italic />
          <TierRow feature="Total"        demo="$0" free="~$0.08/mo" pro="~$0.45/mo" bold />
        </div>

        {/* Principle */}
        <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-800/30 p-4">
          <div className="text-xs text-zinc-300 leading-relaxed">
            <span className="text-zinc-100 font-medium">Design principle:</span> Demo mode costs us nothing because WASM runs on the user's device.
            The gallery limits (12 images in demo, 24 once signed in) and session-only storage are the natural nudge toward signup — no artificial
            "sign in to use blur" gates on tools that run locally. Convex, UploadThing, and Replicate only activate
            after auth, so our bill scales with real users, not drive-by traffic.
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="text-amber-400 text-xs font-medium mb-1">📸 Demo → 12 gallery slots</div>
            <div className="text-[11px] text-zinc-400 leading-relaxed">
              Not about cost (local memory). It's about making the session feel limited. "I edited a dozen photos and now I want to keep them" is the conversion moment.
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="text-emerald-400 text-xs font-medium mb-1">✨ Auto-enhance = Free tier</div>
            <div className="text-[11px] text-zinc-400 leading-relaxed">
              Runs entirely in WASM via histogram analysis. Giving free users one "magic" AI-feeling button that's actually local processing is a trust builder.
            </div>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
            <div className="text-violet-400 text-xs font-medium mb-1">🤖 Free AI = 5/day cap</div>
            <div className="text-[11px] text-zinc-400 leading-relaxed">
              Via <code className="text-pink-300/70">dailyUsage</code> counter. A free user who loves background removal hits the wall and sees the upgrade prompt naturally.
            </div>
          </div>
        </div>

        {/* Cost summary */}
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="text-emerald-400 text-sm font-medium">Low Usage</div>
            <div className="text-2xl font-bold text-emerald-400">~$0</div>
            <div className="text-xs text-zinc-500 mt-1">Free tiers cover it</div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="text-amber-400 text-sm font-medium">At Scale (100 users)</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-amber-400">~$60-150</div>
              <div className="text-xs text-emerald-400">↓ 40%</div>
            </div>
            <div className="text-xs text-zinc-500 mt-1">per month · WASM offloads processing</div>
          </div>
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
            <div className="text-violet-400 text-sm font-medium">Break-even</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-violet-400">~8 Pro</div>
              <div className="text-xs text-emerald-400">↓ from 15</div>
            </div>
            <div className="text-xs text-zinc-500 mt-1">users at $10/mo</div>
          </div>
        </div>
      </div>
    </section>
  );
}
