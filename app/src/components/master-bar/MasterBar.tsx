import { motion } from "framer-motion";
import {
  Upload,
  Wrench,
  Image as ImageIcon,
  BookOpenCheck,
} from "lucide-react";
import { slideFromLeft } from "@/lib/animations";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MASTER_BAR_CHROME_H } from "./constants";

export type MasterTab = "tools" | "gallery" | "review";

interface Props {
  activeTab: MasterTab;
  onTab: (t: MasterTab) => void;
  /** New is an action, not a tab — opens the upload dialog. `newActive` mirrors
   *  whether that dialog is open. */
  onNew: () => void;
  newActive: boolean;
  /** Settings + user controls (rendered as-is from the desktop top bar). */
  settingsSlot: React.ReactNode;
  userSlot: React.ReactNode;
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-40 disabled:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 ${
            active
              ? "bg-theme-primary text-theme-primary-foreground border-theme-primary"
              : "border-border bg-bg-elevated text-text-secondary hover:text-text-primary"
          }`}
        >
          <Icon />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs font-semibold">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const TABS: { id: MasterTab; icon: typeof Wrench; label: string }[] = [
  { id: "tools", icon: Wrench, label: "Tools" },
  { id: "gallery", icon: ImageIcon, label: "Gallery" },
  { id: "review", icon: BookOpenCheck, label: "Review" },
];

/**
 * Compact-mode (≤1000px) "master bar" chrome: a single left strip with the New
 * action + Tools/Gallery/Review tabs + settings/user. The active tab's content
 * (the embedded ToolsSidebar / vertical GalleryBar / embedded ReviewPanel) docks
 * flush below it. At this width the horizontal top bar and the floating side
 * panels are gone — the app is this bar + the status bar + the canvas. Lazily
 * loaded by AppShell, so its bundle only arrives the first time you go narrow.
 */
export function MasterBar({
  activeTab,
  onTab,
  onNew,
  newActive,
  settingsSlot,
  userSlot,
}: Props) {
  return (
    <motion.div
      variants={slideFromLeft}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="region"
      aria-label="Master bar"
      className="fixed left-2 top-2 z-[var(--z-panel)] flex w-[252px] items-center gap-1 overflow-hidden rounded-t-xl border border-b-0 border-border bg-bg-secondary p-2"
      style={{ height: MASTER_BAR_CHROME_H, boxShadow: "var(--shadow-panel)" }}
    >
      {/* New action + the three view tabs + settings/user */}
      <IconBtn icon={Upload} label="New" onClick={onNew} active={newActive} />
      <div className="mx-0.5 h-5 w-px bg-border" />
      {TABS.map((t) => (
        <IconBtn
          key={t.id}
          icon={t.icon}
          label={t.label}
          onClick={() => onTab(t.id)}
          active={activeTab === t.id}
        />
      ))}
      <div className="ml-auto flex items-center gap-1">
        {settingsSlot}
        {userSlot}
      </div>
    </motion.div>
  );
}
