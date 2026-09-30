// SELECT mode for the two group primitives (docs/UI_CONSISTENCY.md §7): the
// roles and the keyboard of a radio group, in one place, so
// `tool-button-group` and `toggle-button-group` cannot drift apart on it.
//
// WHAT A RADIO GROUP OWES A KEYBOARD USER (WAI-ARIA APG, "Radio Group"):
//  - ONE Tab stop for the whole group. The checked option carries
//    tabIndex 0 and every other option -1, so Tab enters the group once
//    and leaves it once. With nothing checked, or with the checked option
//    disabled, the first enabled option is the stop instead, because a
//    group nobody can Tab into is worse than the old behavior.
//  - Arrow keys move between options AND select. Both axes, because the
//    same group is a row on the desktop and a stack on a phone. They wrap
//    at the ends, as the pattern asks.
//  - Home / End jump to the first / last enabled option.
//  - Disabled options are skipped. They stay visible, because a rung
//    above your entitlement is information (constitution rule 5).
//
// Focus follows selection: the option that was just selected is focused in
// the same handler, so `:focus-visible` moves with it and never has to be
// re-established by a second key press.
import * as React from "react";

export interface RadioItemProps {
  role: "radio";
  "aria-checked": boolean;
  tabIndex: 0 | -1;
  ref: (el: HTMLElement | null) => void;
}

interface Options<T extends string> {
  ids: readonly T[];
  /** The checked id. `undefined` = nothing checked yet. */
  selected: T | undefined;
  /** Per-index disabled check, the group-wide flag already folded in. */
  isDisabled: (index: number) => boolean;
  onSelect: (id: T) => void;
}

export function useRadioGroup<T extends string>({
  ids,
  selected,
  isDisabled,
  onSelect,
}: Options<T>) {
  const refs = React.useRef<(HTMLElement | null)[]>([]);

  const checkedIndex = selected === undefined ? -1 : ids.indexOf(selected);
  const firstEnabled = ids.findIndex((_, i) => !isDisabled(i));
  let lastEnabled = -1;
  for (let i = ids.length - 1; i >= 0; i--) {
    if (!isDisabled(i)) {
      lastEnabled = i;
      break;
    }
  }
  const tabStop =
    checkedIndex >= 0 && !isDisabled(checkedIndex) ? checkedIndex : firstEnabled;

  const move = (from: number, step: 1 | -1): number => {
    const n = ids.length;
    for (let k = 1; k <= n; k++) {
      const i = (((from + step * k) % n) + n) % n;
      if (!isDisabled(i)) return i;
    }
    return from;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    // Only when focus is on one of OUR options. A group can sit inside another
    // keyboard-handling region, and a key pressed somewhere else in the tree
    // must never select anything.
    const from = refs.current.indexOf(e.target as HTMLElement);
    if (from < 0) return;
    let to: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        to = move(from, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        to = move(from, -1);
        break;
      case "Home":
        to = firstEnabled;
        break;
      case "End":
        to = lastEnabled;
        break;
      default:
        return;
    }
    // Arrows would otherwise scroll the settings pane underneath.
    e.preventDefault();
    if (to < 0 || to === from) return;
    refs.current[to]?.focus();
    onSelect(ids[to]);
  };

  const itemProps = (index: number): RadioItemProps => ({
    role: "radio",
    "aria-checked": index === checkedIndex,
    tabIndex: index === tabStop ? 0 : -1,
    ref: (el) => {
      refs.current[index] = el;
    },
  });

  return {
    groupProps: { role: "radiogroup" as const, onKeyDown },
    itemProps,
  };
}
