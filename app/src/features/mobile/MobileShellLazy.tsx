// MobileShell as its own chunk. A desktop never draws the phone surface, so it
// should not download it; a phone downloads it instead of the editor's weight
// on top of it. Same props, same name, so the import site is the only change.
import { lazy, Suspense, type ComponentProps } from "react";

const Inner = lazy(() =>
  import("@/features/mobile/MobileShell").then((m) => ({ default: m.MobileShell })),
);

export function MobileShell(props: ComponentProps<typeof Inner>) {
  return (
    // The same opaque layer MobileShell paints, so the editor chrome underneath
    // never flashes through while the chunk arrives.
    <Suspense fallback={<div className="fixed inset-0 z-[var(--z-mobile)] bg-bg-primary" />}>
      <Inner {...props} />
    </Suspense>
  );
}
