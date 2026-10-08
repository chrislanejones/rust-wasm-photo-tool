# Image Horse design context

The editor preserves its existing light warm-paper and dark earth-tone themes. app/src/styles.css is the source of truth for colors, fonts, radii, elevation, motion, and stacking. docs/UI_CONSISTENCY.md defines the measured vocabulary; docs/UI_EXCEPTIONS.md records exceptions.

Typography uses DM Sans for interface text and JetBrains Mono for numeric or code-like readouts. Interface sizes are text-2xs, text-xs, and text-sm. Spacing uses 0, 0.5, 1, 1.5, 2, 3, 4, 6, and 8 Tailwind units. Radius classes are rounded-sm, rounded-md, rounded-lg, and rounded-full.

Reuse components/ui primitives: Button, IconButton, ToolButtonGroup, ToggleButtonGroup, Tooltip, Dialog, ControlRow, StatusMark, AsyncStatus, and Skeleton. Theme token classes and --z-* tokens determine color and stacking. Loading cues use existing delayed conventions and preserve layout. State feedback is functional, never decorative.
