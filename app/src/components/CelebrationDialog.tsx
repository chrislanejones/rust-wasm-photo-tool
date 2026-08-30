import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  PartyPopper,
  Sparkles,
  Eraser,
  Aperture,
  Layers,
  LayoutGrid,
  Palette,
  MousePointerClick,
  RotateCcw,
  ScanEye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CELEBRATION_STATS } from "@/lib/celebrationStats";

/** Shipping stats come from `celebrationStats.ts`, which is GENERATED from
 *  `marketing/src/data/releases.ts` by `marketing/scripts/gen-trail-data.mjs`
 *  — the same script that already regenerates the trail-log squares and the
 *  feature list every release.
 *
 *  They used to be hand-typed here. The comment that stood in this spot said
 *  to "re-derive rather than guess" and warned that the release being cut had
 *  to be in releases.ts first "or the popper ships a release behind its own
 *  changelog". Nothing enforced either, so the numbers sat on July's figures
 *  until 2026-08-30 — 96 August releases later, in an app that had shipped
 *  five more versions. The warning aged into the bug it described.
 *
 *  THE HEADLINE IS ENTRIES, NOT FEATURES. A month can ship more than the one
 *  before it and still carry fewer `feature` tags: August 2026 logged 281
 *  entries across 96 releases against July's 205 across 61, and only 10 of
 *  them were tagged `feature`, because the month went into the engine-worker
 *  migration and the fixes around it. Leading on the feature count would have
 *  rendered the busiest month in the log as the quietest. `Trail.tsx` hit the
 *  same wall and solved it by falling back to total entries; this leads with
 *  entries unconditionally, which needs no threshold to get right. */

/** The month's headline work — icon + label, shown as chips. Drawn from real
 *  release headlines, newest first, and each one checked against
 *  `releases.ts` before it went in: worker v8.32, perspective v8.44–v8.49,
 *  reproducible builds v8.53, layer limit v8.54, cross-layer clicks v8.55.
 *
 *  Hand-written on purpose while the NUMBERS above are generated. A headline
 *  is a judgement about what mattered, and the trail log's `feature` tag does
 *  not carry that — August's biggest change shipped tagged `infra`.
 *
 *  App-facing features only. The trail log this is drawn from covers the
 *  marketing site too, but a chip in the editor for something that only exists
 *  on the website reads as a feature the user cannot find. */
const FEATURES: { icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { icon: Layers, label: "The engine moved into a worker" },
  { icon: LayoutGrid, label: "Layers went from three to eight" },
  { icon: ScanEye, label: "Perspective transform" },
  { icon: MousePointerClick, label: "Clicking another layer stopped inventing one" },
  { icon: Aperture, label: "Colour Overlay on any layer" },
  { icon: RotateCcw, label: "One Ctrl+Z is one step again" },
  { icon: Eraser, label: "Delete removes the shape you picked" },
  { icon: Palette, label: "Same binary three releases running" },
];

const CONFETTI_COLORS = [
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#eab308",
];

interface Particle {
  dx: number;
  dy: number;
  rot: number;
  color: string;
  size: number;
  round: boolean;
  delay: number;
  duration: number;
  left: number;
}

/** A one-shot center-burst confetti popper, generated once per mount.
 *
 *  Geometry is random, and `useMemo`'s callback runs in the RENDER phase, so
 *  the old version called `Math.random()` nine times during render — impure
 *  (ADR-020). Generating on mount instead costs exactly one frame before the
 *  burst, which is invisible against the 0-120ms stagger the particles already
 *  carry, and every span still animates from `initial` to `animate` when it
 *  mounts. Confetti itself only mounts while the dialog is open. */
function Confetti() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 48 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 220;
      return {
        dx: Math.cos(angle) * dist,
        // bias the burst slightly upward, then let it spray out
        dy: Math.sin(angle) * dist - 60,
        rot: (Math.random() - 0.5) * 720,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 6 + Math.random() * 8,
        round: Math.random() > 0.5,
        delay: Math.random() * 0.12,
        duration: 0.9 + Math.random() * 0.7,
        left: 50 + (Math.random() - 0.5) * 12,
        };
      }),
    );
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {particles.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.5, rotate: p.rot }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: "38%",
            width: p.size,
            height: p.size,
            borderRadius: p.round ? "50%" : 2,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Ctrl+\ easter egg — a confetti popper celebrating the week's shipped features,
 * with a few highlighted icons. Pure fun; the confetti regenerates each open
 * because the dialog body only mounts while open.
 */
export function CelebrationDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden">
        {open && <Confetti />}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-theme-accent" />
            {CELEBRATION_STATS.month} shipping spree
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5" style={{ position: "relative", zIndex: 1 }}>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="flex flex-col items-center gap-1 py-1 text-center"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-extrabold tabular-nums text-theme-accent">
                {CELEBRATION_STATS.monthShipped}
              </span>
              <Sparkles className="h-6 w-6 text-theme-accent" />
            </div>
            <span className="text-sm font-semibold text-text-secondary">
              things shipped in {CELEBRATION_STATS.month}&nbsp;🐎
            </span>
            {/* Milestone */}
            <span className="mt-1 rounded-full border border-theme-sidebar-border bg-bg-elevated px-3 py-1 text-2xs font-semibold text-theme-accent">
              across {CELEBRATION_STATS.releases} releases &middot;{" "}
              {CELEBRATION_STATS.features} features, {CELEBRATION_STATS.fixes} fixes
            </span>
          </motion.div>

          {/* Stat row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { n: CELEBRATION_STATS.releases, label: "releases" },
              { n: CELEBRATION_STATS.allTime, label: "all-time" },
              { n: `${CELEBRATION_STATS.monthPct}%`, label: "this month" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-theme-sidebar-border bg-bg-elevated px-2 py-2"
              >
                <div className="text-lg font-bold tabular-nums text-text-primary">
                  {s.n}
                </div>
                <div className="text-2xs uppercase tracking-wide text-text-muted">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {FEATURES.map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.25 }}
                className="flex items-center gap-2 rounded-lg border border-theme-sidebar-border bg-bg-elevated px-3 py-2"
              >
                <Icon className="h-4 w-4 shrink-0 text-theme-accent" />
                <span className="text-2xs font-medium text-text-secondary">
                  {label}
                </span>
              </motion.div>
            ))}
          </div>
        </DialogBody>

        <DialogFooter style={{ position: "relative", zIndex: 1 }}>
          <Button size="large" className="w-full" onClick={() => onOpenChange(false)}>
            <PartyPopper className="h-4 w-4" /> Keep shipping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
