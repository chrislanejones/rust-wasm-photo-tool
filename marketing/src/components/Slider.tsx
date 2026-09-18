import { useCallback, useId, useRef } from "react";

/* A single-value slider, in the anatomy shadcn/Base UI uses — Root › Control ›
 * Track › Indicator › Thumb — written out in plain React and the site's own
 * tokens.
 *
 * Why not the package: this site has no Tailwind, no Radix and no Base UI (see
 * the note in vite.config.ts). Installing three dependencies and a preflight
 * reset to draw one track, one bar and one circle would cost more than the
 * ~90 lines below, and the reset would then fight styles.css on every other
 * page. The anatomy and the keyboard contract are the parts worth copying, so
 * those are copied exactly.
 *
 * The thumb is the control: it carries role="slider", the value, and the focus
 * ring. The track is decoration and is aria-hidden by omission — a pointer
 * lands on the Control, which converts the coordinate to a step.
 */

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max: number;
  step?: number;
  /** Names the control for a screen reader — there is no visible <label>. */
  label: string;
  /** What this stop *is*, spoken instead of the bare number ("v3.10, 21 June"). */
  valueText: string;
  /** One tick per stop. Passed through so the ticks can't drift off the range. */
  ticks?: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export default function Slider({
  value,
  onValueChange,
  min = 0,
  max,
  step = 1,
  label,
  valueText,
  ticks = false,
}: SliderProps) {
  const controlRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  // Guard the degenerate single-stop range: max === min would divide by zero
  // and paint the indicator NaN% wide.
  const span = Math.max(1, max - min);
  const pct = ((clamp(value, min, max) - min) / span) * 100;

  /** Pointer x → the nearest step. Snapping happens here, once, so the drag,
   *  the click and the keyboard all land on the same set of values. */
  const fromPointer = useCallback(
    (clientX: number) => {
      const el = controlRef.current;
      if (!el) return value;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return value;
      const ratio = clamp((clientX - r.left) / r.width, 0, 1);
      return clamp(min + Math.round((ratio * span) / step) * step, min, max);
    },
    [max, min, span, step, value],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    // Left button only, and never the browser's own text-selection drag.
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Focus follows the grab, so releasing the mouse leaves the keyboard on
    // the control you were just using.
    thumbRef.current?.focus();
    onValueChange(fromPointer(e.clientX));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    onValueChange(fromPointer(e.clientX));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  /** The APG slider keys, in full. Home/End and the page keys are the ones
   *  people reach for on a long range, and they are also the cheapest to add. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const page = Math.max(step, Math.round(span / 10));
    const next = {
      ArrowLeft: value - step,
      ArrowDown: value - step,
      ArrowRight: value + step,
      ArrowUp: value + step,
      PageDown: value - page,
      PageUp: value + page,
      Home: min,
      End: max,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onValueChange(clamp(next, min, max));
  };

  const stops = ticks ? Math.round(span / step) + 1 : 0;

  return (
    <span className="slider" data-orientation="horizontal">
      <span
        ref={controlRef}
        className="slider__control"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="slider__track">
          <span className="slider__indicator" style={{ inlineSize: `${pct}%` }} />
          {ticks && (
            <span className="slider__ticks" aria-hidden="true">
              {Array.from({ length: stops }, (_, i) => (
                <span
                  key={i}
                  className="slider__tick"
                  data-passed={min + i * step <= value || undefined}
                />
              ))}
            </span>
          )}
        </span>
        <span
          ref={thumbRef}
          id={id}
          className="slider__thumb"
          style={{ insetInlineStart: `${pct}%` }}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueText}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
        />
      </span>
    </span>
  );
}
