import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
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
import { IconButton } from "@/components/ui/icon-button";
import { MASTER_BAR_CHROME_H } from "./constants";
import type { MasterTab } from "@/stores/useUIStore";

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

/**
 * Tooltip + the shared `IconButton`. This used to be a private 32px button with
 * 16px glyphs and its own active treatment — a fourth icon-button vocabulary,
 * and the one that showed. The `settingsSlot` / `userSlot` below are the
 * desktop top bar's controls passed straight through, and those are `IconButton`
 * at 36px with 18px glyphs, so the master bar shipped four small tabs sitting
 * next to two larger ones. Now everything in this strip is the same button.
 *
 * `aria-pressed` is passed explicitly (it spreads after IconButton's own) so an
 * inactive tab still announces `false`. IconButton's default drops the
 * attribute entirely when off, which is right for the actions it was written
 * for — Undo, the cog — and wrong for a tab.
 */
function IconBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton
          icon={Icon}
          label={label}
          active={active}
          standalone
          aria-pressed={active ?? false}
          disabled={disabled}
          onClick={onClick}
        />
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
  // GEOMETRY, because this bar is a FIXED 252 wide and the height is mirrored
  // elsewhere. Every button is 30px (the shared `IconButton`, sized to the
  // Review panel's toggles) and the cog/user pair sits in a `p-1` container:
  //
  //   width   30 + 1 + 30*3 + 72 (group) = 193, + 5 gaps * 4 = 20, + divider
  //           margins 4, + 12 padding = 229, inside 252 with 23px to spare
  //   height  38 (group) + 12 padding = 50 = MASTER_BAR_CHROME_H
  //
  // `gap-1` and the divider's `mx-0.5` are the ORIGINAL values. They were cut
  // to `gap-0.5` / no margin while the buttons were briefly 36px and the row
  // did not fit; at 30px the room is back, so they are back.
  //
  // The height is the expensive half: three files position their docked panel
  // under this bar with a hardcoded `top-[58px]` (= `top-2` gutter + chrome) —
  // ToolsSidebar, ReviewPanel and GalleryBar. Change the chrome, change those.
  // Noted in constants.ts too, since that is where anyone would look first.
  return (
    <motion.div
      variants={slideFromLeft}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="region"
      aria-label="Master bar"
      className="fixed left-2 top-2 z-[var(--z-panel)] flex w-[252px] items-center gap-1 overflow-hidden rounded-t-xl border border-b-0 border-border bg-bg-secondary p-1.5"
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
      {/* Settings + user, in the same group the desktop top bar gives them.
          They used to sit loose at the end of the strip — the only two controls
          in either bar without a container. */}
      <div className="ml-auto flex items-center gap-1 p-1 rounded-lg bg-bg-tertiary shrink-0">
        {settingsSlot}
        {userSlot}
      </div>
    </motion.div>
  );
}
