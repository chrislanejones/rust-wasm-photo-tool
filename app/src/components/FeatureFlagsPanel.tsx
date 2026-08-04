// Diagnostics → Feature Flags. Answers "what am I actually running with?",
// which previously required grepping seven modules.
//
// Every row reads the module's own predicate (see lib/featureFlags.ts), so what
// this shows is what the app does, not a parallel guess at it.
//
// The WebGPU row carries an extra line because it is the only flag whose
// availability is a property of the MACHINE rather than the profile. `probeWebGpu`
// already returns a reason string for every failure path; without somewhere to
// show it, "why is this off on my laptop?" had no answer.

import { useEffect, useState } from "react";
import { Flag, RotateCcw } from "lucide-react";
import {
  FEATURE_FLAGS,
  isOverridden,
  rawFlagValue,
  setFlagOverride,
  type FeatureFlag,
} from "@/lib/featureFlags";
import { probeWebGpu, type GpuStatus } from "@/lib/webgpu/detect";

function StateChip({ on }: { on: boolean }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-2xs font-bold ${
        on
          ? "border-success/20 bg-success/10 text-success"
          : "border-border/40 bg-bg-elevated/40 text-text-muted"
      }`}
    >
      {on ? "ON" : "OFF"}
    </span>
  );
}

function Row({ flag, onChange }: { flag: FeatureFlag; onChange: () => void }) {
  const on = flag.isOn();
  const overridden = isOverridden(flag);
  const raw = rawFlagValue(flag.key);
  return (
    <tr className="border-t border-border align-top hover:bg-card/30">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <StateChip on={on} />
          <span className="text-text-primary">{flag.label}</span>
          {overridden && (
            <span className="rounded border border-warning/20 bg-warning/10 px-1.5 py-0.5 text-2xs font-bold text-warning">
              OVERRIDDEN
            </span>
          )}
        </div>
        <div className="mt-1 text-2xs text-text-muted">{flag.effect}</div>
        <div className="mt-1 font-mono text-2xs text-text-muted">
          {flag.key}
          {" · "}
          {flag.kind === "kill" ? 'default ON, "0" kills' : 'default OFF, "1" enables'}
          {" · "}
          {raw === null ? "unset" : `stored "${raw}"`}
          {" · "}
          {flag.source}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <button
          onClick={() => {
            setFlagOverride(flag, !overridden);
            onChange();
          }}
          className="rounded px-2 py-1 text-2xs text-text-muted hover:bg-bg-elevated hover:text-text-primary"
        >
          {overridden ? "Reset to default" : flag.kind === "kill" ? "Disable" : "Enable"}
        </button>
      </td>
    </tr>
  );
}

export function FeatureFlagsPanel({ active }: { active: boolean }) {
  // Bumped after a write so every row re-reads localStorage.
  const [rev, setRev] = useState(0);
  const [gpu, setGpu] = useState<GpuStatus | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    // Probe on open rather than at import — requesting an adapter is not free,
    // and a machine without WebGPU should not pay for it just by booting.
    probeWebGpu().then((s) => {
      if (alive) setGpu(s);
    });
    return () => {
      alive = false;
    };
  }, [active]);

  const anyOverridden = FEATURE_FLAGS.some(isOverridden);

  return (
    <div className="px-1 py-1">
      <table className="w-full border-collapse font-mono text-xs">
        <thead className="sticky top-0 bg-background text-text-muted">
          <tr>
            <th className="px-3 py-1.5 text-left font-semibold">
              <span className="flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5" />
                Feature flag
              </span>
            </th>
            <th className="px-3 py-1.5 text-right font-semibold">Change</th>
          </tr>
        </thead>
        <tbody>
          {FEATURE_FLAGS.map((f) => (
            <Row key={f.key + rev} flag={f} onChange={() => setRev((r) => r + 1)} />
          ))}
        </tbody>
      </table>

      {/* The machine's own capability, separate from anyone's preference. */}
      <div className="mt-3 border-t border-border px-3 pt-3 font-mono text-2xs text-text-muted">
        <span className="text-text-secondary">WebGPU on this machine: </span>
        {gpu === null
          ? "probing…"
          : gpu.ok
            ? `available — ${gpu.adapterInfo} · max texture ${gpu.limits.maxTextureDimension2D} · max workgroup X ${gpu.limits.maxComputeWorkgroupSizeX}`
            : `unavailable — ${gpu.reason}`}
        <div className="mt-1">
          This is hardware, not a setting. The flag above only decides whether the
          app uses it.
        </div>
      </div>

      <div className="mt-2 px-3 pb-2 font-mono text-2xs text-text-muted">
        {anyOverridden ? (
          <span className="text-warning">
            One or more flags are overridden for this browser profile — reload to apply, and
            remember they persist until reset.
          </span>
        ) : (
          "All flags at their shipped defaults."
        )}
        <div className="mt-1 flex items-center gap-1">
          <RotateCcw className="h-3 w-3" />
          Changes need a reload: these are read at module init, not per frame.
        </div>
      </div>
    </div>
  );
}
