export default function ArchitectureDiagram() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 overflow-x-auto">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Image Annotation App</h1>
        </div>
        <p className="text-zinc-500 text-sm">Backend Architecture · v2.0 — <span className="text-orange-400 font-medium">+ WASM / Rust</span></p>
      </header>

      {/* Architecture Diagram */}
      <div className="max-w-7xl mx-auto relative">

        {/* ROW 1: Client Layer */}
        <Label color="blue">Client Layer (Vercel Edge)</Label>

        <div className="grid grid-cols-2 gap-4 mb-4 mt-2">
          <Node title="React App" subtitle="TanStack Router" color="blue" />
          <Node title="Canvas Engine" subtitle="JS ↔ WASM Bridge" color="blue" />
        </div>

        <ArrowDown />

        {/* ROW 2: WASM + Rust Layer (NEW) */}
        <Label color="orange">WASM Processing Layer (Client-Side Rust)</Label>

        <div className="grid grid-cols-4 gap-4 mb-4 mt-2">
          <Node title="image-core.wasm" subtitle="Pixel Manipulation" color="orange" badge="new" />
          <Node title="filters.wasm" subtitle="Brightness · Contrast · Blur" color="orange" badge="new" />
          <Node title="annotation.wasm" subtitle="Shape Rasterization" color="orange" badge="new" />
          <Node title="codec.wasm" subtitle="Encode / Decode · Resize" color="orange" badge="new" />
        </div>

        {/* WASM detail callout */}
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 mb-4 text-xs text-zinc-400 leading-relaxed">
          <div className="flex items-start gap-3">
            <RustLogo />
            <div>
              <span className="text-orange-400 font-semibold">Rust → wasm-pack → .wasm</span>
              <span className="mx-2 text-zinc-600">|</span>
              Built with <code className="text-orange-300/80 bg-orange-500/10 px-1 rounded">wasm-bindgen</code> + <code className="text-orange-300/80 bg-orange-500/10 px-1 rounded">image</code> crate
              <span className="mx-2 text-zinc-600">|</span>
              Loaded via <code className="text-orange-300/80 bg-orange-500/10 px-1 rounded">{"await init()"}</code> on first interaction
              <span className="mx-2 text-zinc-600">|</span>
              <span className="text-emerald-400">~200KB gzipped</span>
            </div>
          </div>
        </div>

        <WasmSplitArrow />

        {/* ROW 3: Auth Layer */}
        <Label color="violet">Authentication (Clerk)</Label>

        <div className="grid grid-cols-4 gap-4 mb-4 mt-2">
          <Node title="Clerk Auth" color="violet" />
          <Node title="Demo Mode" subtitle="Anonymous Session" color="zinc" />
          <Node title="Free Tier" subtitle="5 images/day" color="zinc" />
          <Node title="Paid Tier" subtitle="Unlimited" color="violet" highlighted />
        </div>

        <ArrowDown />

        {/* ROW 4: API Layer */}
        <Label color="emerald">API Layer (Vercel Functions)</Label>

        <div className="grid grid-cols-6 gap-3 mb-4 mt-2">
          <Node title="/api/upload" size="sm" color="emerald" />
          <Node title="/api/process" size="sm" color="emerald" />
          <Node title="/api/ai/*" size="sm" color="violet" />
          <Node title="/api/history" size="sm" color="amber" />
          <Node title="/api/export" size="sm" color="rose" />
          <Node title="Middleware" subtitle="Rate Limit" size="sm" color="zinc" />
        </div>

        <BranchingArrows />

        {/* ROW 5: Services (3 columns) */}
        <div className="grid grid-cols-3 gap-6 mt-2">

          {/* Storage Column */}
          <div>
            <Label color="amber">Storage Layer</Label>
            <div className="space-y-2 mt-2">
              <Node title="UploadThing" subtitle="Original Uploads" color="red" />
              <ArrowDownSmall />
              <Node title="CDN Edge Cache" subtitle="Processed Images" color="amber" />
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
              <TableMini name="projects" icon="📁" />
              <TableMini name="images" icon="🖼" />
              <TableMini name="annotations" icon="✏️" badge="new" />
              <TableMini name="layers" icon="📚" badge="new" />
              <TableMini name="history" icon="⏱" />
              <TableMini name="ai_jobs" icon="🤖" />
              <TableMini name="subscriptions" icon="💳" badge="new" />
            </div>
          </div>

          {/* AI Column */}
          <div>
            <Label color="violet">AI (Replicate)</Label>
            <div className="space-y-2 mt-2">
              <Node title="rembg" subtitle="Background Removal" size="sm" color="violet" badge="free" />
              <Node title="Real-ESRGAN" subtitle="4x Upscaling" size="sm" color="violet" badge="pro" />
              <Node title="SD Inpaint" subtitle="Object Removal" size="sm" color="violet" badge="pro" />
              <Node title="BLIP" subtitle="Auto Alt Text" size="sm" color="violet" badge="free" />
            </div>
          </div>
        </div>

        {/* Expanded Database Schema */}
        <div className="mt-10 pt-6 border-t border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <ConvexLogo />
            <div>
              <h2 className="text-lg font-semibold text-pink-400">Convex Database Schema</h2>
              <p className="text-xs text-zinc-500">Detailed table structure with relationships and indexes</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <TableCard
              name="users"
              fields={[
                { name: "_id", type: "Id<'users'>", key: "pk" },
                { name: "clerkId", type: "string", key: "unique", indexed: true },
                { name: "email", type: "string", indexed: true },
                { name: "name", type: "string?" },
                { name: "avatarUrl", type: "string?" },
                { name: "tier", type: "'free' | 'pro' | 'team'" },
                { name: "dailyUsage", type: "number" },
                { name: "usageResetAt", type: "number" },
                { name: "createdAt", type: "number" },
                { name: "updatedAt", type: "number" },
              ]}
              indexes={["by_clerkId", "by_email"]}
            />

            <TableCard
              name="subscriptions"
              badge="new"
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
              indexes={["by_userId", "by_stripeCustomerId"]}
            />

            <TableCard
              name="projects"
              fields={[
                { name: "_id", type: "Id<'projects'>", key: "pk" },
                { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
                { name: "name", type: "string" },
                { name: "description", type: "string?" },
                { name: "thumbnail", type: "string?" },
                { name: "isPublic", type: "boolean" },
                { name: "shareToken", type: "string?", key: "unique" },
                { name: "imageCount", type: "number" },
                { name: "createdAt", type: "number", indexed: true },
                { name: "updatedAt", type: "number" },
              ]}
              indexes={["by_userId", "by_userId_createdAt", "by_shareToken"]}
            />

            <TableCard
              name="images"
              fields={[
                { name: "_id", type: "Id<'images'>", key: "pk" },
                { name: "projectId", type: "Id<'projects'>", key: "fk", indexed: true },
                { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
                { name: "originalUrl", type: "string" },
                { name: "processedUrl", type: "string?" },
                { name: "thumbnailUrl", type: "string?" },
                { name: "filename", type: "string" },
                { name: "mimeType", type: "string" },
                { name: "width", type: "number" },
                { name: "height", type: "number" },
                { name: "sizeBytes", type: "number" },
                { name: "altText", type: "string?" },
                { name: "order", type: "number" },
                { name: "createdAt", type: "number" },
              ]}
              indexes={["by_projectId", "by_userId", "by_projectId_order"]}
            />

            <TableCard
              name="annotations"
              badge="new"
              fields={[
                { name: "_id", type: "Id<'annotations'>", key: "pk" },
                { name: "imageId", type: "Id<'images'>", key: "fk", indexed: true },
                { name: "layerId", type: "Id<'layers'>", key: "fk", indexed: true },
                { name: "type", type: "'rect' | 'ellipse' | 'path' | 'text' | 'arrow'" },
                { name: "data", type: "JsonValue" },
                { name: "style", type: "{ stroke, fill, opacity }" },
                { name: "transform", type: "{ x, y, rotation, scale }" },
                { name: "locked", type: "boolean" },
                { name: "createdAt", type: "number" },
              ]}
              indexes={["by_imageId", "by_layerId"]}
            />

            <TableCard
              name="layers"
              badge="new"
              fields={[
                { name: "_id", type: "Id<'layers'>", key: "pk" },
                { name: "imageId", type: "Id<'images'>", key: "fk", indexed: true },
                { name: "name", type: "string" },
                { name: "order", type: "number" },
                { name: "visible", type: "boolean" },
                { name: "locked", type: "boolean" },
                { name: "opacity", type: "number" },
                { name: "blendMode", type: "'normal' | 'multiply' | 'screen' | ..." },
              ]}
              indexes={["by_imageId", "by_imageId_order"]}
            />

            <TableCard
              name="history"
              fields={[
                { name: "_id", type: "Id<'history'>", key: "pk" },
                { name: "imageId", type: "Id<'images'>", key: "fk", indexed: true },
                { name: "userId", type: "Id<'users'>", key: "fk" },
                { name: "action", type: "'create' | 'update' | 'delete' | 'ai_*'" },
                { name: "target", type: "'annotation' | 'layer' | 'image'" },
                { name: "targetId", type: "string" },
                { name: "prevState", type: "JsonValue?" },
                { name: "nextState", type: "JsonValue?" },
                { name: "createdAt", type: "number", indexed: true },
              ]}
              indexes={["by_imageId", "by_imageId_createdAt"]}
              note="Undo/redo stack per image"
            />

            <TableCard
              name="ai_jobs"
              fields={[
                { name: "_id", type: "Id<'ai_jobs'>", key: "pk" },
                { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
                { name: "imageId", type: "Id<'images'>", key: "fk", indexed: true },
                { name: "type", type: "'rembg' | 'upscale' | 'inpaint' | 'alt'" },
                { name: "status", type: "'pending' | 'running' | 'done' | 'failed'" },
                { name: "replicateId", type: "string?", indexed: true },
                { name: "input", type: "JsonValue" },
                { name: "output", type: "JsonValue?" },
                { name: "error", type: "string?" },
                { name: "startedAt", type: "number?" },
                { name: "completedAt", type: "number?" },
                { name: "createdAt", type: "number" },
              ]}
              indexes={["by_userId", "by_imageId", "by_replicateId", "by_status"]}
              note="Webhook updates status"
            />
          </div>

          {/* Relationship Diagram */}
          <div className="mt-6 rounded-lg border border-pink-500/20 bg-pink-500/5 p-4">
            <div className="text-pink-400 text-xs font-semibold mb-3">Entity Relationships</div>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 flex-wrap">
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">users</span>
              <span className="text-zinc-600">1 ─── ∞</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">projects</span>
              <span className="text-zinc-600">1 ─── ∞</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">images</span>
              <span className="text-zinc-600">1 ─── ∞</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">layers</span>
              <span className="text-zinc-600">1 ─── ∞</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">annotations</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 mt-2 flex-wrap">
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">users</span>
              <span className="text-zinc-600">1 ─── 1</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">subscriptions</span>
              <span className="mx-4 text-zinc-700">|</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">images</span>
              <span className="text-zinc-600">1 ─── ∞</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">history</span>
              <span className="mx-4 text-zinc-700">|</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">images</span>
              <span className="text-zinc-600">1 ─── ∞</span>
              <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300">ai_jobs</span>
            </div>
          </div>

          {/* Convex Features */}
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
              <div className="text-pink-400 font-medium mb-1">🕐 Scheduled Jobs</div>
              <div className="text-zinc-500">Cron for daily usage reset, AI job cleanup.</div>
            </div>
          </div>
        </div>

        <ConvergingArrows />

        {/* ROW 6: Webhooks */}
        <Label color="zinc">Event Handlers (Webhooks)</Label>

        <div className="grid grid-cols-4 gap-4 mt-2">
          <Node title="Clerk Webhook" subtitle="User Sync → users table" size="sm" color="zinc" />
          <Node title="Stripe Webhook" subtitle="Sub changes → subscriptions" size="sm" color="zinc" badge="new" />
          <Node title="UploadThing Webhook" subtitle="File Ready → images table" size="sm" color="zinc" />
          <Node title="Replicate Webhook" subtitle="AI Complete → ai_jobs table" size="sm" color="zinc" />
        </div>

        {/* Legend */}
        <div className="mt-10 pt-6 border-t border-zinc-800">
          <div className="flex flex-wrap gap-6 text-xs text-zinc-500">
            <LegendItem color="#3b82f6" label="Client Flow" />
            <LegendItem color="#f97316" label="WASM / Rust" />
            <LegendItem color="#10b981" label="API Flow" />
            <LegendItem color="#8b5cf6" label="AI Processing" />
            <LegendItem color="#f59e0b" label="Storage" />
            <LegendItem color="#ec4899" label="Database" />
            <LegendItem color="#71717a" label="Webhooks" dashed />
          </div>
        </div>

        {/* Cost Summary */}
        <div className="mt-6 grid grid-cols-3 gap-4">
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Components
   ═══════════════════════════════════════════════════════════════════════════ */

function Node({ title, subtitle = undefined, color = "zinc", size = "md", highlighted = false, badge = undefined }: {
  title: string;
  subtitle?: string;
  color?: string;
  size?: "sm" | "md";
  highlighted?: boolean;
  badge?: string;
}) {
  const colors: Record<string, string> = {
    blue: "border-blue-500/50 bg-blue-500/10 text-blue-400",
    violet: "border-violet-500/50 bg-violet-500/10 text-violet-400",
    emerald: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
    amber: "border-amber-500/50 bg-amber-500/10 text-amber-400",
    pink: "border-pink-500/50 bg-pink-500/10 text-pink-400",
    red: "border-red-500/50 bg-red-500/10 text-red-400",
    orange: "border-orange-500/50 bg-orange-500/10 text-orange-400",
    rose: "border-rose-500/50 bg-rose-500/10 text-rose-400",
    zinc: "border-zinc-600 bg-zinc-800/50 text-zinc-400",
  };

  const badgeColors: Record<string, string> = {
    new: "bg-orange-500/20 text-orange-400",
    free: "bg-emerald-500/20 text-emerald-400",
    pro: "bg-violet-500/20 text-violet-400",
  };

  const padding = size === "sm" ? "px-3 py-2" : "px-4 py-3";
  const titleSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className={`rounded-lg border ${colors[color]} ${padding} ${highlighted ? "ring-2 ring-violet-500/50" : ""}`}>
      <div className="flex items-center justify-between">
        <div className={`font-medium ${titleSize}`}>{title}</div>
        {badge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badgeColors[badge] || "bg-zinc-700 text-zinc-400"}`}>
            {badge}
          </span>
        )}
      </div>
      {subtitle && <div className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function TableMini({ name, icon, badge = undefined }: { name: string; icon: string; badge?: string }) {
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

function TableCard({ name, fields, indexes, badge = undefined, note = undefined }: {
  name: string;
  fields: { name: string; type: string; key?: string; indexed?: boolean; comment?: string }[];
  indexes?: string[];
  badge?: string;
  note?: string;
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
      {note && (
        <div className="px-2 pb-2 text-[9px] text-zinc-500 italic">{note}</div>
      )}
    </div>
  );
}

function Label({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-400 bg-blue-500",
    violet: "text-violet-400 bg-violet-500",
    emerald: "text-emerald-400 bg-emerald-500",
    amber: "text-amber-400 bg-amber-500",
    pink: "text-pink-400 bg-pink-500",
    orange: "text-orange-400 bg-orange-500",
    zinc: "text-zinc-400 bg-zinc-500",
  };

  const parts = colors[color].split(" ");
  const textColor = parts[0];
  const dotColor = parts[1];

  return (
    <div className={`text-xs font-medium uppercase tracking-wider flex items-center gap-2 mt-4 ${textColor}`}>
      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      {children}
    </div>
  );
}

function LegendItem({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
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
        <text x="450" y="28" textAnchor="middle" fill="#71717a" fontSize="11" fontFamily="monospace">→ server</text>
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
