// Pins panel: where the next pin goes, and Renumber. The sequence and the
// action come from useAnnotationStore (published by hooks/usePinSteps); the
// rules are lib/pinSteps.ts.
import { useState } from "react";
import { ListOrdered, MapPin, MessageSquareText, MoveUpRight, Slash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { TextField } from "@/components/ui/number-field";
import { pinLabelText } from "@/lib/pinLabel";
import { nextPinNumber, parsePinLabel } from "@/lib/pinSteps";
import { useAnnotationStore } from "@/stores/useAnnotationStore";

// Smart Callout v1 rides the Pins tab rather than being its own sub-tool:
// the Shapes sub-mode reaches useDrawingTools through AppShell, which gains
// nothing new. Callout = pin + label + leader (lib/callouts.ts).
const DROP = [
  { id: "pin", label: "Pin", icon: MapPin },
  { id: "callout", label: "Callout", icon: MessageSquareText },
] as const;

// What a new callout's leader is drawn as (lib/callouts `LEADER_KIND`). Line
// is the default; callouts made before keep their arrow.
const LEADER = [
  { id: "line", label: "Line", icon: Slash },
  { id: "arrow", label: "Arrow", icon: MoveUpRight },
] as const;

export function PinStepsControls({ letters }: { letters: boolean }) {
  const { max, gaps } = useAnnotationStore((s) => s.pinSequence);
  const pinNext = useAnnotationStore((s) => s.pinNext);
  const setPinNext = useAnnotationStore((s) => s.setPinNext);
  const renumber = useAnnotationStore((s) => s.renumberPins);
  const callout = useAnnotationStore((s) => s.calloutMode);
  const setCallout = useAnnotationStore((s) => s.setCalloutMode);
  const leader = useAnnotationStore((s) => s.calloutLeader);
  const setLeader = useAnnotationStore((s) => s.setCalloutLeader);
  const next = nextPinNumber(max, pinNext);
  const shown = pinLabelText(next, letters ? 1 : 0);
  // What is being typed; the field shows the live Next value otherwise.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const n = parsePinLabel(draft);
    // "After the last" is the default, not a fixed number that goes stale.
    if (n !== null) setPinNext(n > max ? null : n);
    setDraft(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader
        title="Steps"
        info={
          <>
            Steps renumber themselves: delete a pin and the rest close up; set
            Next to a number already used to insert a step there. Only pins on
            the active layer count as one sequence; a pin on another layer
            keeps its number. A Callout is a pin with a label joined by a
            leader: type the label and press Enter. Leader picks a plain line
            or an arrow for the next callout. Drag the pin or the label and the
            leader follows; delete the pin and all three go. The label uses
            the Text tool&apos;s font, size and color.
          </>
        }
      />
      <ToolButtonGroup
        aria-label="Drop"
        options={DROP}
        value={callout ? "callout" : "pin"}
        onChange={(id) => setCallout(id === "callout")}
      />
      {callout && (
        <ToolButtonGroup aria-label="Leader" options={LEADER} value={leader} onChange={setLeader} />
      )}
      <div className="flex items-end gap-2">
        <TextField
          label="Next"
          className="max-w-20"
          inputMode={letters ? "text" : "numeric"}
          value={draft ?? shown}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setDraft(null);
          }}
        />
        <Button
          variant="secondary"
          className="flex-1"
          disabled={!gaps || !renumber}
          onClick={() => renumber?.()}
          title="Number the pins 1, 2, 3… again, in their order, closing every gap"
        >
          <ListOrdered aria-hidden /> Renumber
        </Button>
      </div>
    </div>
  );
}
