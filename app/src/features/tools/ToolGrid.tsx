// ===== FILE: app/src/features/tools/ToolGrid.tsx =====
// The TOP-LEVEL RAIL — five group tiles, one row.
//
// Was eleven tool tiles wrapping 5/5/1. The five-group restructure makes the
// top row legible at a glance and moves the granularity down into SubtoolRow;
// the cost is one extra click to reach a sub-tool, which ADR-023 records.
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TOOL_GROUPS, type ToolGroupId } from "./toolGroups";
import { activateGroup, useActiveGroup } from "./activateSubTool";
import { ToolButton } from "./ToolButton";

interface Props {
  /** Groups whose tile should render faded + non-clickable, keyed by group id.
   *  Values may be a boolean (disabled) or a short reason string shown in the
   *  tooltip instead of the regular description. */
  disabledGroups?: Partial<Record<ToolGroupId, boolean | string>>;
}

export function ToolGrid({ disabledGroups }: Props) {
  const activeGroup = useActiveGroup();

  return (
    // 5 columns for 5 groups — exactly one row, no ragged wrap. It must still
    // MATCH SubtoolRow's column count: the two grids share a tile size, so the
    // header grows in exact one-tile steps as the sub-tool row changes height.
    // Change one, change both.
    <div className="grid grid-cols-5 gap-2" role="toolbar" aria-label="Select tool group">
      {TOOL_GROUPS.map((group) => {
        const disabledEntry = disabledGroups?.[group.id];
        const isDisabled = Boolean(disabledEntry);
        const disabledReason =
          typeof disabledEntry === "string" ? disabledEntry : null;
        return (
          <Tooltip key={group.id}>
            <TooltipTrigger asChild>
              <div className="w-full">
                <ToolButton
                  icon={group.icon}
                  label={group.label}
                  active={group.id === activeGroup?.id}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    activateGroup(group);
                  }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p className="font-semibold">
                {group.label}{" "}
                <kbd className="font-normal text-muted-foreground">
                  {group.shortcutKey}
                </kbd>
              </p>
              <p className="text-muted-foreground text-xs">
                {disabledReason ?? group.description}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
