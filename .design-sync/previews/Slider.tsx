// The site's one form control, in the anatomy shadcn/Base UI uses
// (Root › Control › Track › Indicator › Thumb) written in plain React.
//
// It is CONTROLLED: value in, onValueChange out, and it stores nothing. So a
// preview has to hold the state — which is the honest demonstration, because
// that is what every caller does.
import "./preview.css";
import { useState } from "react";
import { Slider as SliderCmp } from "photo-horse-marketing";

/* How the Trail Log drives it: one stop per release, and valueText speaks the
   version and date instead of the bare index — "17" tells a screen-reader user
   nothing. */
export function Releases() {
  const [i, setI] = useState(14);
  const stops = ["v8.84", "v8.93", "v8.96", "v8.97", "v8.98", "v8.99", "v9.0", "v9.1"];
  return (
    <SliderCmp
      value={i}
      onValueChange={setI}
      min={0}
      max={stops.length - 1}
      label="Release"
      valueText={`${stops[i] ?? stops[0]}, 26 September`}
      ticks
    />
  );
}

/* A plain 0–100 range with no ticks — the shape to reach for when the stops
   are numbers and not named things. */
export function Percent() {
  const [v, setV] = useState(64);
  return (
    <SliderCmp
      value={v}
      onValueChange={setV}
      max={100}
      step={1}
      label="Quality"
      valueText={`${v}%`}
    />
  );
}
