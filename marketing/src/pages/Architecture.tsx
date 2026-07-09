// Backend architecture diagram. Restored in v0.9.10 (the v2.9 pass removed
// it); the old Tier Strategy & Access Matrix section is intentionally gone —
// the live Pricing section on the home page is the canonical pricing sheet.

/* ───────────────────────── Primitives ───────────────────────── */

type NodeColor =
  | "blue" | "violet" | "emerald" | "amber" | "pink"
  | "red" | "rose" | "orange" | "zinc";

const NODE_COLORS: Record<NodeColor, string> = {
  blue: "border-blue-500/50 bg-blue-500/10 text-blue-400",
  violet: "border-violet-500/50 bg-violet-500/10 text-violet-400",
  emerald: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
  amber: "border-amber-500/50 bg-amber-500/10 text-amber-400",
  pink: "border-pink-500/50 bg-pink-500/10 text-pink-400",
  red: "border-red-500/50 bg-red-500/10 text-red-400",
  rose: "border-rose-500/50 bg-rose-500/10 text-rose-400",
  orange: "border-orange-500/50 bg-orange-500/10 text-orange-400",
  zinc: "border-zinc-600/50 bg-zinc-800/50 text-zinc-300",
};

const BADGE_COLORS: Record<string, string> = {
  pro: "bg-violet-500/20 text-violet-400",
  free: "bg-zinc-700 text-zinc-400",
  new: "bg-orange-500/20 text-orange-400",
  soon: "bg-amber-500/20 text-amber-400",
};

function Node({
  title, subtitle, color = "zinc", size = "md", highlighted = false, badge,
}: {
  title: string; subtitle?: string; color?: NodeColor;
  size?: "sm" | "md"; highlighted?: boolean; badge?: string;
}) {
  const padding = size === "sm" ? "px-3 py-2" : "px-4 py-3";
  const titleSize = size === "sm" ? "text-xs" : "text-sm";
  return (
    <div className={`rounded-lg border ${NODE_COLORS[color]} ${padding} ${highlighted ? "ring-2 ring-violet-500/50" : ""}`}>
      <div className="flex items-center justify-between">
        <div className={`font-medium ${titleSize}`}>{title}</div>
        {badge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BADGE_COLORS[badge] ?? "bg-zinc-700 text-zinc-400"}`}>
            {badge}
          </span>
        )}
      </div>
      {subtitle && <div className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function TableMini({ name, icon, badge }: { name: string; icon: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded bg-pink-500/10 border border-pink-500/30">
      <div className="flex items-center gap-2">
        <span className="text-xs">{icon}</span>
        <span className="text-xs font-mono text-pink-300">{name}</span>
      </div>
      {badge && (
        <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">{badge}</span>
      )}
    </div>
  );
}

interface TableField {
  name: string;
  type: string;
  key?: "pk" | "fk" | "unique";
  indexed?: boolean;
  comment?: string;
}

function TableCard({
  name, fields, indexes, badge, note,
}: {
  name: string; fields: TableField[]; indexes?: string[]; badge?: string; note?: string;
}) {
  return (
    <div className="rounded-lg border border-pink-500/30 bg-pink-500/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-pink-500/10 border-b border-pink-500/20">
        <span className="font-mono text-sm text-pink-300 font-medium">{name}</span>
        {badge && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">{badge}</span>
        )}
      </div>
      <div className="p-2 space-y-0.5 text-[10px] font-mono">
        {fields.map((field, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className={`shrink-0 ${field.key === "pk" ? "text-amber-400" : field.key === "fk" ? "text-blue-400" : field.key === "unique" ? "text-emerald-400" : "text-zinc-500"}`}>
              {field.key === "pk" ? "🔑" : field.key === "fk" ? "🔗" : field.key === "unique" ? "◆" : "·"}
            </span>
            <span className="text-pink-200">{field.name}</span>
            <span className="text-zinc-600">:</span>
            <span className="text-zinc-400 truncate">{field.type}</span>
            {field.indexed && <span className="text-amber-500/60 text-[8px]">idx</span>}
          </div>
        ))}
      </div>
      {indexes && indexes.length > 0 && (
        <div className="px-2 pb-2 pt-1 border-t border-pink-500/10">
          <div className="text-[9px] text-zinc-600 mb-0.5">indexes:</div>
          <div className="flex flex-wrap gap-1">
            {indexes.map((idx, i) => (
              <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/80 font-mono">{idx}</span>
            ))}
          </div>
        </div>
      )}
      {note && <div className="px-2 pb-2 text-[9px] text-zinc-500 italic">{note}</div>}
    </div>
  );
}

const LABEL_COLORS: Record<string, [string, string]> = {
  blue: ["text-blue-400", "bg-blue-500"],
  violet: ["text-violet-400", "bg-violet-500"],
  emerald: ["text-emerald-400", "bg-emerald-500"],
  amber: ["text-amber-400", "bg-amber-500"],
  pink: ["text-pink-400", "bg-pink-500"],
  orange: ["text-orange-400", "bg-orange-500"],
  zinc: ["text-zinc-400", "bg-zinc-500"],
};

function Label({ children, color }: { children: React.ReactNode; color: string }) {
  const [textColor, dotColor] = LABEL_COLORS[color] ?? LABEL_COLORS.zinc;
  return (
    <div className={`text-xs font-medium uppercase tracking-wider flex items-center gap-2 mt-4 ${textColor}`}>
      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      {children}
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="24" height="4" viewBox="0 0 24 4">
        <line x1="0" y1="2" x2="24" y2="2" stroke={color} strokeWidth="3" strokeDasharray={dashed ? "4 3" : "none"} />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function RustLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="10" stroke="#f97316" strokeWidth="1.5" />
      <text x="12" y="16" textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="bold" fontFamily="monospace">R</text>
    </svg>
  );
}

function ConvexLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <rect x="2" y="2" width="20" height="20" rx="4" stroke="#ec4899" strokeWidth="1.5" />
      <path d="M7 12 L12 7 L17 12 L12 17 Z" fill="#ec4899" fillOpacity="0.3" stroke="#ec4899" strokeWidth="1" />
    </svg>
  );
}

/* ───────────────────────── Arrows ───────────────────────── */

function ArrowDown() {
  return (
    <div className="flex justify-center py-3">
      <svg width="24" height="36" viewBox="0 0 24 36" fill="none">
        <path d="M12 0 L12 28 M6 22 L12 28 L18 22" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ArrowDownSmall() {
  return (
    <div className="flex justify-center py-1">
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
        <path d="M8 0 L8 14 M4 10 L8 14 L12 10" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function WasmSplitArrow() {
  return (
    <div className="flex justify-center py-3">
      <svg width="100%" height="64" viewBox="0 0 600 64" preserveAspectRatio="xMidYMid meet" fill="none">
        <path d="M300 0 L300 16" stroke="#f97316" strokeWidth="2" />
        <path d="M150 16 L450 16" stroke="#52525b" strokeWidth="2" />
        <path d="M150 16 L150 32" stroke="#f97316" strokeWidth="2" />
        <text x="150" y="48" textAnchor="middle" fill="#f97316" fontSize="11" fontFamily="monospace">client-side ⟳</text>
        <path d="M450 16 L450 56 M444 50 L450 56 L456 50" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="450" y="48" textAnchor="middle" fill="#71717a" fontSize="11" fontFamily="monospace" dy="-20">→ server</text>
      </svg>
    </div>
  );
}

function BranchingArrows() {
  return (
    <div className="flex justify-center py-3">
      <svg width="100%" height="56" viewBox="0 0 600 56" preserveAspectRatio="xMidYMid meet" fill="none">
        <path d="M300 0 L300 20" stroke="#52525b" strokeWidth="2" />
        <path d="M100 20 L500 20" stroke="#52525b" strokeWidth="2" />
        <path d="M100 20 L100 48 M94 42 L100 48 L106 42" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M300 20 L300 48 M294 42 L300 48 L306 42" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M500 20 L500 48 M494 42 L500 48 L506 42" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ConvergingArrows() {
  return (
    <div className="flex justify-center py-3 mt-4">
      <svg width="100%" height="56" viewBox="0 0 600 56" preserveAspectRatio="xMidYMid meet" fill="none">
        <path d="M100 0 L100 20 L300 20" stroke="#52525b" strokeWidth="2" strokeDasharray="6 4" />
        <path d="M500 0 L500 20 L300 20" stroke="#52525b" strokeWidth="2" strokeDasharray="6 4" />
        <path d="M300 20 L300 48 M294 42 L300 48 L306 42" stroke="#52525b" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function Architecture() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 overflow-x-auto">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Image Horse</h1>
          </div>
          <a
            href="/system-architecture.mermaid"
            download
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download diagram (.mermaid)
          </a>
        </div>
        <p className="text-zinc-500 text-sm">
          Backend Architecture — <span className="text-orange-400 font-medium">WASM / Rust</span>
          <span className="mx-2 text-zinc-700">·</span>
          <span className="text-zinc-600">pricing &amp; tier limits live on the <a href="/#pricing" className="text-zinc-400 underline hover:text-zinc-200">Pricing section</a></span>
        </p>
      </header>

      <div className="max-w-7xl mx-auto relative">
        {/* ROW 1: Client Layer */}
        <Label color="blue">Client Layer (runs entirely in the browser)</Label>
        <div className="grid grid-cols-3 gap-4 mb-4 mt-2">
          <Node title="React App" subtitle="Vite + React 19 · Netlify static SPA" color="blue" />
          <Node title="Canvas Engine" subtitle="JS ↔ WASM bridge · zero-copy blit" color="blue" />
          <Node title="Zustand State" subtitle="5 stores · atomic selectors" color="blue" />
        </div>

        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 mb-4 text-xs text-zinc-400 leading-relaxed">
          No account needed — every tool above runs client-side, no server round-trip. Signed-out
          originals and edits live in IndexedDB (SHA-256 content-addressed, read through a Dexie
          adapter); "remember my choice" UI prefs persist to their own{" "}
          <code className="text-blue-300/80 bg-blue-500/10 px-1 rounded">image-horse-zustand</code>{" "}
          IndexedDB database. Nothing here talks to Convex until you sign in.
        </div>

        <ArrowDown />

        {/* ROW 2: WASM + Rust Layer — ONE binary, internal modules */}
        <Label color="orange">WASM Processing Layer (Client-Side Rust · single binary)</Label>
        <div className="grid grid-cols-3 gap-4 mb-4 mt-2">
          <Node title="core · layer" subtitle="ImageBuffer · layer stack · composite / mask" color="orange" />
          <Node title="paint · effects" subtitle="Brush / eraser / mask · blur / pixelate / redact" color="orange" />
          <Node title="annotations · selection" subtitle="Live text & shape overlays · magic-wand" color="orange" />
          <Node title="stamp · transform" subtitle="Clone brush · flip / rotate / resize / crop" color="orange" />
          <Node title="filters" subtitle="Brightness · contrast · gaussian blur" color="orange" />
          <Node title="drawing · text" subtitle="Arrows / shapes / bézier · embedded fonts" color="orange" />
          <Node title="codec · history" subtitle="PNG encode (Rust) · undo snapshots" color="orange" />
          <Node title="simd" subtitle="v128/f32x4 kernels · scalar fallback" color="orange" />
          <Node title="utils" subtitle="json · point math · shared helpers" color="orange" />
        </div>

        {/* WASM detail callout */}
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 mb-4 text-xs text-zinc-400 leading-relaxed">
          <div className="flex items-start gap-3">
            <RustLogo />
            <div>
              <span className="text-orange-400 font-semibold">Rust → wasm-pack → stamp_tool.wasm</span>
              <span className="mx-2 text-zinc-600">|</span>
              Built with <code className="text-orange-300/80 bg-orange-500/10 px-1 rounded">wasm-bindgen</code> + <code className="text-orange-300/80 bg-orange-500/10 px-1 rounded">png</code> + <code className="text-orange-300/80 bg-orange-500/10 px-1 rounded">ab_glyph</code>
              <span className="mx-2 text-zinc-600">|</span>
              One binary so every module shares a single pixel buffer in linear memory — zero-copy between tools
              <span className="mx-2 text-zinc-600">|</span>
              <span className="text-emerald-400">~540 KB</span> (font subsetting once cut it 1.1 MB → 443 KB; new tools have grown it back up some since)
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-orange-500/20 bg-zinc-900/40 px-4 py-3 mb-4 text-xs text-zinc-400 leading-relaxed">
          <span className="text-orange-300 font-medium">Codec worker</span> — a Vite module Web Worker
          (Comlink-wrapped) handles WebP/JPEG export encode and gallery thumbnails off the main thread,
          with a silent main-thread fallback if the worker fails to start. PNG export stays on the Rust
          encoder above.
        </div>

        <WasmSplitArrow />

        {/* ROW 3: Auth Layer */}
        <Label color="violet">Authentication (Clerk)</Label>
        <div className="grid grid-cols-4 gap-4 mb-4 mt-2">
          <Node title="Clerk Auth" color="violet" />
          <Node title="Demo Mode" subtitle="Anonymous · 12 photos" color="zinc" />
          <Node title="Free Tier" subtitle="Logged in · 24 photos" color="zinc" />
          <Node title="Pro Tier" subtitle="100 photos · coming soon" color="violet" highlighted />
        </div>

        <ArrowDown />

        {/* ROW 4: Convex functions */}
        <Label color="emerald">Convex Functions (signed-in only)</Label>
        <div className="grid grid-cols-6 gap-3 mb-4 mt-2">
          <Node title="photoEdits.ts" subtitle="save / getEdit" size="sm" color="emerald" />
          <Node title="ai.ts" subtitle="dispatch to Replicate" size="sm" color="violet" />
          <Node title="aiJobs.ts" subtitle="job status (useQuery)" size="sm" color="violet" />
          <Node title="shares.ts" subtitle="public share links" size="sm" color="amber" />
          <Node title="textHistory.ts" subtitle="recent texts" size="sm" color="rose" />
          <Node title="stripe.ts" subtitle="checkout / portal" size="sm" color="zinc" />
        </div>
        <p className="text-[11px] text-zinc-500 mb-4 leading-relaxed">
          WASM does the pixel work locally — this layer only syncs metadata and edit archives for
          signed-in users. None of it sits on the critical editing path; the app works fully logged out.
        </p>

        <BranchingArrows />

        {/* ROW 5: Services */}
        <div className="grid grid-cols-3 gap-6 mt-2">
          {/* Storage Column */}
          <div>
            <Label color="amber">Storage Layer</Label>
            <div className="space-y-2 mt-2">
              <Node title="IndexedDB (Dexie)" subtitle="Originals · SHA-256 content-addressed" color="red" />
              <ArrowDownSmall />
              <Node title="Convex File Storage" subtitle="Edit archives · shares · AI frames" color="amber" />
            </div>
            <div className="mt-2 text-[10px] text-zinc-500 leading-relaxed">
              UploadThing hosts exactly one thing: the built-in <span className="text-zinc-400">Test Images</span> set
              behind the upload dialog's button — royalty-free demo photos, not user uploads. Cloud
              storage for a Pro user's own originals (S3 / UploadThing / R2) is designed but not wired —
              the Connect buttons in Settings are disabled today.
            </div>
          </div>

          {/* Database Column */}
          <div className="col-span-1">
            <Label color="pink">Database (Convex)</Label>
            <div className="mt-2 text-[10px] text-zinc-500 mb-2">
              Real-time sync · Reactive queries · TypeScript schema
            </div>
            <div className="space-y-1">
              <TableMini name="users" icon="👤" />
              <TableMini name="subscriptions" icon="💳" />
              <TableMini name="photo_edits" icon="🖼" />
              <TableMini name="recent_texts" icon="📝" />
              <TableMini name="shares" icon="🔗" />
              <TableMini name="ai_jobs" icon="🤖" />
            </div>
          </div>

          {/* AI Column */}
          <div>
            <Label color="violet">AI (Replicate, Pro only)</Label>
            <div className="space-y-2 mt-2">
              <Node title="cjwbw/rembg" subtitle="Background Removal" size="sm" color="violet" badge="pro" />
              <Node title="abiruyt/text-extract-ocr" subtitle="Text Extract" size="sm" color="violet" badge="pro" />
              <Node title="zylim0702/remove-object" subtitle="Object Removal (masked)" size="sm" color="violet" badge="pro" />
              <Node title="Real-ESRGAN" subtitle="4x Upscale" size="sm" color="violet" badge="soon" />
            </div>
          </div>
        </div>

        {/* Expanded database schema */}
        <div className="mt-10 pt-6 border-t border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <ConvexLogo />
            <div>
              <h2 className="text-lg font-semibold text-pink-400">Convex Database Schema</h2>
              <p className="text-xs text-zinc-500">Detailed table structure with relationships and indexes</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <TableCard
              name="users"
              fields={[
                { name: "_id", type: "Id<'users'>", key: "pk" },
                { name: "clerkId", type: "string", key: "unique", indexed: true },
                { name: "email", type: "string?", indexed: true },
                { name: "name", type: "string?" },
                { name: "avatarUrl", type: "string?" },
                { name: "tier", type: "'free' | 'pro' | 'team'" },
                { name: "dailyUsage", type: "number" },
                { name: "usageResetAt", type: "number" },
                { name: "settings", type: "string?", comment: "JSON blob, app prefs" },
                { name: "settingsHash", type: "string?", comment: "SHA-256, skips redundant writes" },
                { name: "createdAt", type: "number" },
                { name: "updatedAt", type: "number" },
              ]}
              indexes={["by_clerkId", "by_email"]}
            />
            <TableCard
              name="subscriptions"
              fields={[
                { name: "_id", type: "Id<'subscriptions'>", key: "pk" },
                { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
                { name: "stripeCustomerId", type: "string", indexed: true },
                { name: "stripeSubId", type: "string", key: "unique" },
                { name: "plan", type: "'pro' | 'team'" },
                { name: "status", type: "'active' | 'canceled' | 'past_due'" },
                { name: "currentPeriodEnd", type: "number" },
                { name: "cancelAtPeriodEnd", type: "boolean" },
              ]}
              indexes={["by_userId", "by_stripeCustomerId", "by_stripeSubId"]}
            />
            <TableCard
              name="photo_edits"
              fields={[
                { name: "_id", type: "Id<'photo_edits'>", key: "pk" },
                { name: "userId", type: "Id<'users'>", key: "fk" },
                { name: "photoKey", type: "string", comment: "the editor's own photo id" },
                { name: "storageId", type: "Id<'_storage'>", key: "fk", comment: "binary canvas archive" },
                { name: "canvasW", type: "number" },
                { name: "canvasH", type: "number" },
                { name: "updatedAt", type: "number" },
              ]}
              indexes={["by_userId_photoKey"]}
              note="Real per-photo edit persistence path (useEditPersistence.ts)"
            />
            <TableCard
              name="recent_texts"
              fields={[
                { name: "_id", type: "Id<'recent_texts'>", key: "pk" },
                { name: "userId", type: "Id<'users'>", key: "fk" },
                { name: "text", type: "string" },
                { name: "fontSize", type: "number" },
                { name: "fontFamily", type: "string?" },
                { name: "fontWeight", type: "'normal' | 'bold'" },
                { name: "textColor", type: "string" },
                { name: "usedAt", type: "number" },
              ]}
              indexes={["by_userId", "by_userId_usedAt"]}
              note="Text-tool history, per signed-in user"
            />
            <TableCard
              name="shares"
              fields={[
                { name: "_id", type: "Id<'shares'>", key: "pk" },
                { name: "token", type: "string", indexed: true, comment: "unguessable, public lookup key" },
                { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
                { name: "storageId", type: "Id<'_storage'>", key: "fk", comment: "flattened canvas PNG" },
                { name: "canvasW", type: "number" },
                { name: "canvasH", type: "number" },
                { name: "title", type: "string?" },
                { name: "views", type: "number" },
                { name: "createdAt", type: "number" },
              ]}
              indexes={["by_token", "by_userId"]}
              note="Public, no-auth read — anyone with the link can view/download"
            />
            <TableCard
              name="ai_jobs"
              fields={[
                { name: "_id", type: "Id<'ai_jobs'>", key: "pk" },
                { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
                { name: "photoKey", type: "string", indexed: true },
                { name: "type", type: "'rembg' | 'upscale' | 'inpaint' | 'ocr' | 'alt'" },
                { name: "status", type: "'pending' | 'running' | 'done' | 'failed'" },
                { name: "replicateId", type: "string?", indexed: true },
                { name: "inputStorageId", type: "Id<'_storage'>?" },
                { name: "maskStorageId", type: "Id<'_storage'>?", comment: "inpaint mask" },
                { name: "outputStorageId", type: "Id<'_storage'>?" },
                { name: "output", type: "JsonValue?", comment: "non-image result, e.g. OCR text" },
                { name: "error", type: "string?" },
                { name: "startedAt", type: "number?" },
                { name: "completedAt", type: "number?" },
                { name: "createdAt", type: "number" },
              ]}
              indexes={["by_userId", "by_userId_photoKey", "by_replicateId", "by_status"]}
              note="Keyed by photoKey, not a real images row — Replicate webhook updates status"
            />
          </div>

          {/* Relationship Diagram */}
          <div className="mt-6 rounded-lg border border-pink-500/20 bg-pink-500/5 p-4">
            <div className="text-pink-400 text-xs font-semibold mb-3">Entity Relationships</div>
            <p className="text-[10px] text-zinc-500 mb-3">
              Flatter than a typical projects→images tree: every row below hangs straight off{" "}
              <code className="text-pink-300/70">users</code>, keyed by the client's own{" "}
              <code className="text-pink-300/70">photoKey</code> string rather than a server-side image id.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 flex-wrap">
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">users</span>
              <span className="text-zinc-600">1 ─── 1</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">subscriptions</span>
              <span className="mx-4 text-zinc-700">|</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">users</span>
              <span className="text-zinc-600">1 ─── ∞</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">photo_edits</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 mt-2 flex-wrap">
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">users</span>
              <span className="text-zinc-600">1 ─── ∞</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">recent_texts</span>
              <span className="mx-4 text-zinc-700">|</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">users</span>
              <span className="text-zinc-600">1 ─── ∞</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">shares</span>
              <span className="mx-4 text-zinc-700">|</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">users</span>
              <span className="text-zinc-600">1 ─── ∞</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">ai_jobs</span>
            </div>
          </div>

          {/* Convex Features Callout */}
          <div className="mt-4 grid grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
              <div className="text-pink-400 font-medium mb-1">⚡ Real-time</div>
              <div className="text-zinc-500">useQuery hooks auto-update when data changes. No polling.</div>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
              <div className="text-pink-400 font-medium mb-1">🔒 Row-level Auth</div>
              <div className="text-zinc-500">ctx.auth in mutations + query filters for user-scoped data.</div>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
              <div className="text-pink-400 font-medium mb-1">📦 File Storage</div>
              <div className="text-zinc-500">Integrated blob storage for images via storage.getUrl().</div>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
              <div className="text-pink-400 font-medium mb-1">🔗 Webhooks</div>
              <div className="text-zinc-500">Replicate + Stripe post back to convex/http.ts (HMAC-verified), updating ai_jobs / subscriptions.</div>
            </div>
          </div>
        </div>

        <ConvergingArrows />

        {/* ROW 6: Webhooks */}
        <Label color="zinc">Event Handlers (Webhooks)</Label>
        <div className="grid grid-cols-2 gap-4 mt-2 max-w-xl">
          <Node title="Stripe Webhook" subtitle="Sub changes → subscriptions" size="sm" color="zinc" />
          <Node title="Replicate Webhook" subtitle="AI complete → ai_jobs.status" size="sm" color="zinc" />
        </div>
        <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
          Clerk sign-in isn't a webhook here — the client calls{" "}
          <code className="text-zinc-400">users.upsert</code> once Convex's own auth bridge comes up,
          which is what actually creates the <code className="text-zinc-400">users</code> row.
        </p>

        {/* Legend */}
        <div className="mt-10 pt-6 border-t border-zinc-800">
          <div className="flex flex-wrap gap-6 text-xs text-zinc-500">
            <LegendItem color="#3b82f6" label="Client Flow" />
            <LegendItem color="#f97316" label="WASM / Rust" />
            <LegendItem color="#10b981" label="Convex Functions" />
            <LegendItem color="#8b5cf6" label="AI Processing" />
            <LegendItem color="#f59e0b" label="Storage" />
            <LegendItem color="#ec4899" label="Database" />
            <LegendItem color="#71717a" label="Webhooks" dashed />
          </div>
        </div>
      </div>
    </div>
  );
}
