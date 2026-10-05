// The loaded-document accessor (Plan C §3). The engine mirror (`stamp.state`)
// describes whatever document the engine holds — which, for the length of a
// photo switch, is the OUTGOING photo while everything else already names the
// incoming one. A component that reads its width, height or undo depth
// directly shows the old photo's numbers under the new photo's name.
//
// Read document state through this instead: it is the state when the engine
// holds the photo you asked for, and null while a switch is in flight — so a
// readout shows "—" (or a skeleton), never the other photo's numbers.
// scripts/guardrails.sh counts direct reads in components; the count may only
// go down.
import { usePhotoSwitching } from "./usePhotoSwitching";

export function useLoadedDocument<T>(state: T): T | null {
  const switching = usePhotoSwitching();
  return switching ? null : state;
}
