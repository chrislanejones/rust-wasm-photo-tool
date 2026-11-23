# 16. Accessibility

[← 15.3 The a12 Design](15.3-Engine-Worker-A12-Design.md) · [Contents](README.md)

**WCAG 2.1 AA is a project rule, not a nice-to-have.** Every control can be
reached and used from the keyboard, focus is always visible, and new UI is
checked for contrast before it ships. The UI rules that carry this are in
[6.1 UI Consistency](06.1-UI-Consistency.md), rule **R8** and §7.

## What the editor does

| Area | What you get | Where it lives |
| --- | --- | --- |
| **Keyboard** | Every tool and dialog works without a mouse. `Alt + /` lists every shortcut; [5. Keyboard Shortcuts](05-Keyboard-Shortcuts.md) mirrors it. | `useKeyboardShortcuts.ts`, `shortcutGroups.ts` |
| **Choice groups** | A row where you pick one (Raster \| Vector \| With Layers, the Crop ratios, the theme) is a real **radio group**: one Tab stop, arrow keys move and pick, Home and End jump to the ends, and a screen reader hears which one is on. | `ui/use-radio-group.ts`, used by `ToolButtonGroup` and `ToggleButtonGroup` |
| **On/off buttons** | A button that stays on says so (`aria-pressed`); a plain action never claims to be "not pressed". | `ToggleButtonGroup` (toggle mode), `ToolButton` |
| **Focus** | Keyboard focus has its own ring and its own color, separate from "selected" and "hover", so all three can show at once and still be told apart. | [ADR-025](adr/025-focus-is-its-own-visual-channel.md), `HOVER_RING` and `focus-visible` styles |
| **Names** | A control is named by the words you see next to it (`aria-labelledby` points at a row's label), so what a screen reader says matches what's on screen. Icon-only buttons carry the name their tooltip shows. | `ui/control-row.tsx` |
| **Announcements** | Progress, results and errors are spoken: toasts (Download All's "Zipping 3 of 12…"), the working / saved lines, spinners, and the pairing steps are live regions. | `ui/status-note.tsx`, `ui/async-status.tsx`, `ui/spinner.tsx`, Sonner toasts |
| **Dialogs** | Dialogs keep focus inside while open and close on Escape; New and Export have exactly one Close button (pinned by `pane-header-row`). | `ui/dialog` (Radix) |
| **Motion** | The system's "reduce motion" setting is honored, and **Settings › Appearance › Reduce motion** does the same inside the app: panel slides, springs, the skeleton shimmer and the name flash stop. | `styles.css` (`html.reduce-motion`), `AppearancePane.tsx` |
| **Touch** | Phone controls are built to a 44 px minimum height, the touch-target rule. | `min-h-11`, [6.1](06.1-UI-Consistency.md) §3 |
| **Contrast** | Text colors come from the theme tokens, light and dark, and muted text is measured against the surface it actually sits on. | `styles.css` tokens |

## How it's tested

| Test | What it pins |
| --- | --- |
| `e2e/ui-night14-accessibility.spec.ts` | Settings' tab rail with roving keyboard focus; muted text and shortcut headings meet AA on their real surface colors |
| `e2e/ui-night3-panels.spec.ts` | tool-panel rows and swatches are named radio groups, one Tab stop each; a slider shows the focus ring on keyboard focus; a disabled button says why |
| `e2e/gallery-keyboard-actions.spec.ts` | the gallery works from the keyboard |
| `e2e/export-dialog.spec.ts` | the Export rows are radio groups, one Tab stop each; Alt+E opens Export |
| Component tests (`*.test.tsx`, ADR-077) | roles, names and states of the shared primitives, without a browser |

Many other specs find controls by role and accessible name
(`getByRole("radio", { name: … })`), so a control that loses its name or role
fails a test that was written for something else entirely.

## Known limits

| Limit | Why |
| --- | --- |
| A slider's spoken value (`aria-valuetext`) is in the page but can't be checked by our browser probe | Chromium's DevTools protocol ignores `aria-valuetext` even on a plain slider, so the probe can't see it either way ([Parking Lot](PARKING_LOT.md)) |
| The canvas itself is a picture | A screen reader can't describe what's drawn on it. The tools around it, the layers and the history are all reachable and named. |

---

[← 15.3 The a12 Design](15.3-Engine-Worker-A12-Design.md) · [Contents](README.md)
