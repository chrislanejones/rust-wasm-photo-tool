// Pins panel: where the next pin goes, and Renumber. The sequence and the
// action come from useAnnotationStore (published by hooks/usePinSteps); the
// rules are lib/pinSteps.ts.
import { useState } from "react";
import { ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/number-field";
import { pinLabelText } from "@/lib/pinLabel";
import { nextPinNumber, parsePinLabel } from "@/lib/pinSteps";
import { useAnnotationStore } from "@/stores/useAnnotationStore";

export function PinStepsControls({ letters }: { letters: boolean }) {
  const { max, gaps } = useAnnotationStore((s) => s.pinSequence);
  const pinNext = useAnnotationStore((s) => s.pinNext);
  const setPinNext = useAnnotationStore((s) => s.setPinNext);
  const renumber = useAnnotationStore((s) => s.renumberPins);
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
      <p className="text-2xs text-theme-muted-foreground">
        Steps renumber themselves: delete a pin and the rest close up; set Next
        to a number already used to insert a step there. Only pins on the
        active layer count as one sequence; a pin on another layer keeps its
        number.
      </p>
    </div>
  );
}
