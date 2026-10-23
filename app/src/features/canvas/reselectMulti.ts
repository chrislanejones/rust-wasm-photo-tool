// The Reselect list's half of multi-select (Night 10-22): Shift-click a row
// to add it to the selection or take it out; a plain click lets the
// multi-selection go and opens the object as before. While two or more are
// picked every row shows a check, and the picked ones announce "selected".
import { NONE, has, pickedCount, toggle, type Picked } from "@/lib/annotationSelection";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import type { ReselectObject } from "./ReviewPanel";

export function reselectMultiProps(picked: Picked, o: ReselectObject, open: () => void) {
  const { setPicked } = useAnnotationStore.getState();
  return {
    onSelect: () => {
      if (pickedCount(picked)) setPicked(NONE);
      open();
    },
    // Like a canvas Shift-click: adding a callout part adds the whole
    // callout; taking one out takes out just that object.
    onShiftSelect: () =>
      setPicked((p) => {
        if (has(p, o.type, o.id)) return toggle(p, o.type, o.id);
        const grow = useAnnotationStore.getState().expandPick;
        return grow ? grow(toggle(p, o.type, o.id)) : toggle(p, o.type, o.id);
      }),
    checked: pickedCount(picked) > 1 ? has(picked, o.type, o.id) : undefined,
  };
}
