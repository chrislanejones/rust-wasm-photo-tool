import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  PartyPopper,
  Sparkles,
  Eraser,
  Paintbrush,
  Aperture,
  ChartArea,
  BoxSelect,
  Grid3x3,
  ImageDown,
  Layers,
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

/** Live shipping stats (July 2026, through v0.9.85 · Jul 2–22).
 *
 *  Counted from `marketing/src/data/releases.ts`, the hand-written trail log,
 *  NOT typed in by hand — 42 July releases, 109 entries, against 400 all-time.
 *  Tag split for July: fix 34, rust 21, feature 20, ui 17, infra 16, perf 1.
 *  Re-derive rather than guess when this is next refreshed. */
const STATS = {
  monthShipped: 109, // entries logged in July across 42 releases
  releases: 42,
  allTime: 400, // all-time trail-log entries
  monthPct: 27, // July = 27% of everything ever shipped
};

/** July's headline work — icon + label, shown as chips. Drawn from real
 *  release headlines, newest first. */
const FEATURES: { icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { icon: Eraser, label: "Object removal (local)" },
  { icon: Paintbrush, label: "AI tool → Eraser tool" },
  { icon: Aperture, label: "Magnetic lasso" },
  { icon: Layers, label: "Undo that survives reload" },
  { icon: BoxSelect, label: "Command palette" },
  { icon: Grid3x3, label: "Open + save .ora projects" },
  { icon: ImageDown, label: "Strip photo location" },
  { icon: ChartArea, label: "Offline app shell" },
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
            July shipping spree
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
                {STATS.monthShipped}
              </span>
              <Sparkles className="h-6 w-6 text-theme-accent" />
            </div>
            <span className="text-sm font-semibold text-text-secondary">
              features and fixes shipped in July&nbsp;🐎
            </span>
            {/* Milestone */}
            <span className="mt-1 rounded-full border border-theme-sidebar-border bg-bg-elevated px-3 py-1 text-2xs font-semibold text-theme-accent">
              20 features and 34 fixes, across {STATS.releases} releases
            </span>
          </motion.div>

          {/* Stat row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { n: STATS.releases, label: "releases" },
              { n: STATS.allTime, label: "all-time" },
              { n: `${STATS.monthPct}%`, label: "this month" },
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
