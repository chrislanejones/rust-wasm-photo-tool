// Settings → "S3 / Image Hosting". Connect where a Pro user's ORIGINAL full-res
// uploads are stored: Amazon S3, UploadThing, or Cloudflare R2. Free / demo keep
// originals on-device, so the whole pane is Pro-gated.
//
// The Connect buttons are DISABLED for now — the upload pipeline (/api/upload →
// provider → Convex `images` row + webhook) and the secure credential store
// aren't wired yet. This is the entry point that lights up once they land.
import { Server, UploadCloud, Cloud, Lock } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  blurb: string;
  icon: typeof Server;
}

const PROVIDERS: Provider[] = [
  {
    id: "s3",
    name: "Amazon S3",
    blurb: "Your AWS bucket — your bytes never touch our infra.",
    icon: Server,
  },
  {
    id: "uploadthing",
    name: "UploadThing",
    blurb: "Managed hosting — zero setup, 5 GB included.",
    icon: UploadCloud,
  },
  {
    id: "r2",
    name: "Cloudflare R2",
    blurb: "S3-compatible storage with zero egress fees.",
    icon: Cloud,
  },
];

interface Props {
  /** tier === "pro" | "team". Gates the whole pane. */
  isPaid: boolean;
  /** null when signed out, else the tier string. */
  tier: string | null;
}

export function StoragePane({ isPaid, tier }: Props) {
  if (tier === null) {
    return (
      <Shell>
        <p className="text-sm text-text-secondary">
          Sign in with a Pro account to connect cloud storage for your original
          uploads.
        </p>
      </Shell>
    );
  }

  if (!isPaid) {
    return (
      <Shell>
        <div className="rounded-lg border border-violet-500/40 bg-violet-500/5 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-violet-400">
            <Lock className="h-4 w-4" /> Pro feature
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">
            Connecting cloud storage for original, full-res uploads is part of
            Pro. On the Free plan your edits sync, but originals stay on your
            device. Upgrade from{" "}
            <span className="font-medium text-text-primary">Plan &amp; Billing</span>{" "}
            to connect a provider.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-2">
        {PROVIDERS.map((p) => (
          <ProviderRow key={p.id} provider={p} />
        ))}
      </div>
      <p className="text-2xs leading-relaxed text-text-muted">
        Connections are coming soon — once the upload pipeline lands, connecting a
        provider here will store every original you upload to your chosen host.
      </p>
    </Shell>
  );
}

function ProviderRow({ provider }: { provider: Provider }) {
  const { name, blurb, icon: Icon } = provider;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-elevated px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-5 w-5 shrink-0 text-text-muted" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-primary">{name}</div>
          <div className="truncate text-2xs text-text-muted">{blurb}</div>
        </div>
      </div>
      <button
        type="button"
        disabled
        title="Coming soon"
        className="shrink-0 cursor-not-allowed rounded-md border border-border bg-bg-tertiary/40 px-3 py-1.5 text-xs font-medium text-text-muted opacity-60"
      >
        Connect
      </button>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">
          S3 / Image Hosting
        </h3>
        <p className="mt-0.5 text-2xs text-text-muted">
          Connect where your original full-res uploads are stored. Pro only —
          Free and demo keep originals on-device.
        </p>
      </div>
      {children}
    </div>
  );
}
