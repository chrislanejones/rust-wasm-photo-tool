// Stroke-stabilizer level tiles: one pen, four trails. The pen is the same in
// every glyph; only the line behind it changes — jagged (Off), wobbly (Low),
// one soft wave (Med), a clean sweep (High) — so the four read as one scale.
//
// Stroked thinner than lucide's 2 so the trail's detail survives at the
// stacked tile's 24px; the pen's clip dot is the one filled mark.
import type React from "react";

const PEN = (
  <>
    <path d="M14.1 17.4 14.8 9.9 18.2 6.4 21.7 8.5 20.6 12.7Z" />
    <path d="m18.2 6.4 1-1.6q.4-.6 1-.2l2.1 1.3q.6.4.2 1l-.8 1.6" />
    <path d="m14.1 17.4 3.9-6.2" />
    <circle cx="18.3" cy="10.7" r=".75" fill="currentColor" stroke="none" />
  </>
);

const TRAILS = {
  off: "M2 19 L5.3 14.9 L5.6 19.7 L9 14.2 L9.1 19.6 L11.9 16.8 L12.4 19.1 L14.1 17.4",
  low: "M2 19 C3.1 17.7 3.6 18.8 4.8 18 C6.2 17 7.2 15.4 8.4 16.3 C9.4 17.1 9.1 19.2 10.4 18.8 C11.7 18.3 11.6 17.2 12.6 17.8 Q13.5 18.7 14.1 17.4",
  med: "M2 19 C4.6 16.5 6.2 15.6 8.1 16.6 C10.2 17.7 11.8 20.7 14.1 17.4",
  high: "M2 19.7 C5.4 17.3 8.6 16.6 11.3 17.4 Q13.2 18 14.1 17.4",
} as const;

function stabilizerIcon(trail: string): React.ComponentType<{ className?: string }> {
  function StabilizerIcon({ className }: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={trail} />
        {PEN}
      </svg>
    );
  }
  return StabilizerIcon;
}

export const StabilizerOffIcon = stabilizerIcon(TRAILS.off);
export const StabilizerLowIcon = stabilizerIcon(TRAILS.low);
export const StabilizerMedIcon = stabilizerIcon(TRAILS.med);
export const StabilizerHighIcon = stabilizerIcon(TRAILS.high);
