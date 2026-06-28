import { useMemo } from "react";
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
import { LargeButton } from "@/components/ui/large-button";

/** Live shipping stats (June 2026, through v0.9.31 · Jun 12–27). */
const STATS = {
  monthFeatures: 67, // features shipped in June (65 → 67 with v0.9.31)
  releases: 24,
  allTime: 90, // crossed 90 lifetime features with this push
  monthPct: 74, // June = 74% of all-time features
};

/** This week's headline features — icon + label, shown as chips. */
const FEATURES: { icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { icon: Eraser, label: "Eraser tool" },
  { icon: Paintbrush, label: "Brush hardness" },
  { icon: Aperture, label: "Layer masks" },
  { icon: Layers, label: "Layer Settings + Ctrl+M" },
  { icon: BoxSelect, label: "Rust selection marker" },
  { icon: Grid3x3, label: "Transparency checkerboard" },
  { icon: ImageDown, label: "Drag & paste import" },
  { icon: ChartArea, label: "Histogram drop anim" },
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

/** A one-shot center-burst confetti popper, generated once per mount. */
function Confetti() {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: 48 }, () => {
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
    });
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
            June feature spree
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
                {STATS.monthFeatures}
              </span>
              <Sparkles className="h-6 w-6 text-theme-accent" />
            </div>
            <span className="text-sm font-semibold text-text-secondary">
              features shipped in June&nbsp;🐎
            </span>
            {/* Milestone */}
            <span className="mt-1 rounded-full border border-theme-sidebar-border bg-bg-elevated px-3 py-1 text-2xs font-semibold text-theme-accent">
              Just crossed {STATS.allTime} lifetime features!
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
          <LargeButton className="w-full" onClick={() => onOpenChange(false)}>
            <PartyPopper className="h-4 w-4" /> Keep shipping
          </LargeButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
