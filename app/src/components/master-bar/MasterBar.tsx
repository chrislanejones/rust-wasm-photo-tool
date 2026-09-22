import { motion } from "framer-motion";
import {
  Upload,
  Wrench,
  Image as ImageIcon,
  BookOpenCheck,
  Download,
} from "lucide-react";
import { slideFromLeft } from "@/lib/animations";
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
  /** Export — also an action, never a tab. Replaced the Tools panel's
   *  full-width "Download & Share {FORMAT}" footer, which spent an entire row
   *  of a 252px sidebar on one button. */
  onExport: () => void;
  canExport: boolean;
  /** Settings + user controls (rendered as-is from the desktop top bar). */
  settingsSlot: React.ReactNode;
  userSlot: React.ReactNode;
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
  onExport,
  canExport,
  settingsSlot,
  userSlot,
}: Props) {
  // GEOMETRY, because this bar is a FIXED 252 wide and the height is mirrored
  // elsewhere. Every button is 30px (the shared `IconButton`, sized to the
  // Review panel's toggles) and the cog/user pair sits in a `p-1` container:
  //
  //   width   30*5 + 72 (group) = 222, + 5 gaps * 2 = 10, + 12 padding = 244,
  //           inside 252 with 8px to spare
  //   height  38 (group) + 12 padding = 50 = MASTER_BAR_CHROME_H
  //
  // `gap-0.5` and no divider, because Export made five buttons and four plus a
  // divider no longer fit: at `gap-1` the row measures 254 against a 252 box.
  // The 4px gaps and the divider's `mx-0.5` were the values before that, and
  // they had themselves been cut to 0.5 once already while the buttons were
  // briefly 36px. The buttons are still 30px — it is the count that changed.
  // The divider is gone on purpose rather than to save its 5px: New and Export
  // are both ACTIONS while the middle three are tabs, so a rule after New
  // grouped one action with three tabs and left the other action outside.
  //
  // The height is the expensive half: the docked panel under this bar sits at
  // `top-[58px]` (= `top-2` gutter + chrome). That offset lives once, in
  // constants.ts MASTER_BAR_CONTENT_BOX, beside the chrome height itself.
  return (
    <motion.div
      variants={slideFromLeft}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="region"
      aria-label="Master bar"
      className="fixed left-2 top-2 z-[var(--z-panel)] flex w-[252px] items-center justify-between overflow-hidden rounded-t-xl border border-b-0 border-border bg-bg-secondary p-1.5 shadow-panel"
      style={{ height: MASTER_BAR_CHROME_H }}
    >
      {/* New · Tools · Gallery · Review · Export, one run of five, then
          settings/user. New and Export are actions; the middle three are tabs. */}
      {/* The shared `IconButton` + its hint tooltip, `standalone` because
          there is no group pill behind this strip. This was a private
          `IconBtn` wrapper; before that, a 32px button with its own active
          treatment — a fourth icon-button vocabulary. Now everything in the
          strip is the same button as the slots beside it.
          NOT `aria-pressed={active ?? false}`: IconButton omits the
          attribute when off, which is right for New and Export (actions,
          never toggles). */}
      <IconButton icon={Upload} label="New" onClick={onNew} active={newActive} standalone tooltip />
      {TABS.map((t) => (
        <IconButton
          key={t.id}
          icon={t.icon}
          label={t.label}
          onClick={() => onTab(t.id)}
          active={activeTab === t.id}
          standalone
          tooltip
        />
      ))}
      <IconButton
        icon={Download}
        label="Export"
        onClick={onExport}
        disabled={!canExport}
        standalone
        tooltip
      />
      {/* Settings + user, loose like everything else: this bar is ONE flat row
          now, justify-between across the box and no group pills — the same rule
          the desktop top bar follows in its compact band. Both slots arrive
          standalone from AppShell so they carry their own fill. */}
      {settingsSlot}
      {userSlot}
    </motion.div>
  );
}
