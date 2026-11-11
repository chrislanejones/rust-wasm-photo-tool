/* The content of /design-system, kept apart from its presentation.
 *
 * Every claim here is about the EDITOR (app/), not this marketing site, and is
 * grounded in a file that exists: the rules in docs/UI_CONSISTENCY.md, the
 * colors in app/src/styles.css (read through the generated editorTokens.ts),
 * the components in app/src/components/ui/. `app/src/lib/editorTokens.drift.test.ts`
 * checks that every path below still exists, so a moved or deleted file fails
 * CI instead of shipping a dead link. */

export const REPO_BLOB = "https://github.com/chrislanejones/rust-wasm-photo-tool/blob/master/";

export interface Section { id: string; title: string }

export const SECTIONS: readonly Section[] = [
  { id: "principles", title: "Principles" },
  { id: "color", title: "Colors and themes" },
  { id: "type", title: "Typography" },
  { id: "space", title: "Spacing, layout and radii" },
  { id: "components", title: "Components" },
  { id: "states", title: "Loading and interaction states" },
  { id: "a11y", title: "Accessibility and consistency" },
];

export const PRINCIPLES: readonly { title: string; body: string }[] = [
  { title: "Consistency over novelty", body: "A control looks and behaves the same everywhere it appears. A new look has to earn its place against the one people already know." },
  { title: "One primitive per pattern", body: "If components/ui has it, the editor imports it. A hand-rolled copy of something that already exists is treated as the defect, even when it looks right." },
  { title: "Honest feedback", body: "Loading, progress and errors say what is actually happening. Nothing spins forever, and an error always says what failed and offers a way out." },
  { title: "The document is the truth", body: "The engine owns the pixels and the open document. While a photo switch is in flight the UI reads nothing from the photo that is leaving." },
  { title: "Fast on the canvas", body: "Painting, dragging and handles stay under a frame. UI work that can wait moves off the pointer path." },
  { title: "Keyboard and focus first", body: "Every control is reachable from the keyboard, says what it is, and shows where focus is." },
  { title: "Local first, your call", body: "Edits run in your browser. Anything that needs a server says so, and the editor still works with it switched off." },
];

/** The swatch groups. Each name is a token in app/src/styles.css. */
export const COLOR_GROUPS: readonly { title: string; tokens: readonly string[]; note?: string }[] = [
  { title: "Backgrounds and surfaces", tokens: ["bg-primary", "bg-secondary", "bg-tertiary", "bg-elevated", "popover"] },
  { title: "Text", tokens: ["text-primary", "text-secondary", "text-muted"] },
  { title: "Accent and selection", tokens: ["accent", "primary", "primary-strong", "secondary"], note: "primary-strong is the ink of a selected tile. The light accent is too pale to be read as text on its own tint." },
  { title: "Borders and focus", tokens: ["border", "border-active", "input", "focus-ring"], note: "Focus is neutral ink, not the accent: the accent already means \"selected\"." },
  { title: "Status", tokens: ["success", "warning", "destructive", "destructive-strong"] },
];

export const TYPE_SCALE: readonly { cls: string; px: string; use: string }[] = [
  { cls: "text-2xs", px: "10px", use: "Keyboard chips, dense counters, footers" },
  { cls: "text-xs", px: "12px", use: "Most panel text: labels, buttons, helper lines" },
  { cls: "text-sm", px: "14px", use: "Body copy in dialogs and section headers" },
  { cls: "text-lg", px: "17–20px", use: "Headings only (fluid)" },
];

/** R1 in docs/UI_CONSISTENCY.md: eight steps, in Tailwind units. */
export const SPACING: readonly { unit: string; px: number }[] = [
  { unit: "0.5", px: 2 }, { unit: "1", px: 4 }, { unit: "1.5", px: 6 }, { unit: "2", px: 8 },
  { unit: "3", px: 12 }, { unit: "4", px: 16 }, { unit: "6", px: 24 }, { unit: "8", px: 32 },
];

export const RADII: readonly { cls: string; px: string; use: string }[] = [
  { cls: "rounded-sm", px: "4px", use: "Chips, small inputs" },
  { cls: "rounded-md", px: "6px", use: "Fields, list rows (--radius)" },
  { cls: "rounded-lg", px: "10px", use: "Buttons, tiles, panels (--radius-lg)" },
  { cls: "rounded-full", px: "pill", use: "Pills only" },
];

export const SURFACES: readonly { name: string; width: string; what: string }[] = [
  { name: "Desktop", width: "wide windows", what: "The full editor: the tool rail, the side panels, the gallery and the review panel, floating over the canvas." },
  { name: "Dock / tablet", width: "about 960px", what: "The same tools in a compact layout, for a snapped window or a tablet. Panels tighten; nothing is removed." },
  { name: "Phone", width: "about 390px", what: "The Mobile version: browse the gallery, add photos and download. It does not have the editing tools." },
];

export type ComponentCategory = "Actions" | "Controls" | "Feedback" | "Surfaces";

export interface ComponentDoc {
  name: string;
  category: ComponentCategory;
  source: string;
  what: string;
}

export const COMPONENTS: readonly ComponentDoc[] = [
  { name: "Button", category: "Actions", source: "app/src/components/ui/button.tsx", what: "The one text button: default, ghost, secondary and link variants on a size axis." },
  { name: "IconButton", category: "Actions", source: "app/src/components/ui/icon-button.tsx", what: "A single square icon button: the top bar's Undo, Redo, Zoom and Settings." },
  { name: "ToolButton", category: "Actions", source: "app/src/components/ui/tool-button.tsx", what: "A tile in a tool grid; selected, idle and disabled are three separate looks." },
  { name: "ToggleButtonGroup", category: "Controls", source: "app/src/components/ui/toggle-button-group.tsx", what: "A row of buttons in a pill. Independent toggles announce aria-pressed; as a choice (mode=\"select\") it is a radio group." },
  { name: "ToolButtonGroup", category: "Controls", source: "app/src/components/ui/tool-button-group.tsx", what: "A grid of options. Passing a value makes it a radio group: one Tab stop, arrow keys." },
  { name: "NumberField", category: "Controls", source: "app/src/components/ui/number-field.tsx", what: "A labeled number box, its word attached with a real label so a screen reader says what the number is." },
  { name: "SizeSlider", category: "Controls", source: "app/src/components/ui/size-slider.tsx", what: "A slider with a readout; arrow keys step by one even when the track uses presets." },
  { name: "ControlRow", category: "Controls", source: "app/src/components/ui/control-row.tsx", what: "Label on the left, live value on the right, the control underneath, and the reason under that when it is off." },
  { name: "Skeleton", category: "Feedback", source: "app/src/components/ui/skeleton.tsx", what: "Content that exists but hasn't arrived. Still under Reduce Motion." },
  { name: "Spinner", category: "Feedback", source: "app/src/components/ui/spinner.tsx", what: "Work in progress inside a button or line. Keeps turning under Reduce Motion: a frozen spinner reads as a hang." },
  { name: "StatusMark", category: "Feedback", source: "app/src/components/ui/status-mark.tsx", what: "One mark per meaning: complete, working, attention, failed, backed up, on this device." },
  { name: "AsyncStatus", category: "Feedback", source: "app/src/components/ui/async-status.tsx", what: "The five states of anything that waits, in one view." },
  { name: "ReasonNote", category: "Feedback", source: "app/src/components/ui/status-note.tsx", what: "Why a control is off right now. Muted, not a warning: a step is missing." },
  { name: "ToolPanel", category: "Surfaces", source: "app/src/components/ui/tool-panel.tsx", what: "The vertical rhythm of a tool panel's body: header, controls, sections and actions, 16px apart." },
  { name: "Dialog", category: "Surfaces", source: "app/src/components/ui/dialog.tsx", what: "The modal primitive, with the shared scrim and focus trap." },
  { name: "Tooltip", category: "Surfaces", source: "app/src/components/ui/tooltip.tsx", what: "Hover and focus hints. The native title attribute is not used as a tooltip." },
  { name: "PanelActionBar", category: "Surfaces", source: "app/src/components/ui/panel-action-bar.tsx", what: "The actions at the foot of a settings panel: Apply Crop, Reset and Apply, Resize." },
];

export const ASYNC_STATES: readonly { state: string; means: string; shows: string }[] = [
  { state: "Ready", means: "nothing pending", shows: "nothing extra" },
  { state: "Loading", means: "fetching something that exists", shows: "skeletons in place of what it will fill" },
  { state: "Processing", means: "computing something new", shows: "the source stays visible and inert; progress when the length is known" },
  { state: "Saved", means: "a result landed somewhere durable", shows: "a check mark, briefly" },
  { state: "Error", means: "it didn't work", shows: "what failed, in words, and an action, usually Try again" },
];

export const A11Y_RULES: readonly { title: string; body: string }[] = [
  { title: "WCAG 2.1 AA", body: "The bar for every surface. Contrast pairs are measured, and the measurements are written next to the tokens." },
  { title: "A choice says which choice", body: "Exclusive options are a named radio group with aria-checked. aria-pressed is only for independent toggles." },
  { title: "Focus you can see", body: "A dashed outline in neutral ink on every interactive element. Selected, hover and focus each use their own channel, so they never look alike." },
  { title: "Announced, not just shown", body: "A failure is an alert. A validation line that changes while you type is polite, so it never interrupts every keystroke." },
  { title: "Targets you can hit", body: "Touch targets are sized for a finger, and pinned by a test." },
  { title: "Loading means loading", body: "A region that is loading says so to a screen reader and is inert until it isn't; an error replaces the progress instead of sitting beside it." },
  { title: "One owner for each value", body: "A value is per photo, per tool or app-wide, and the UI reads it from that owner, never from a copy that may describe the photo that is leaving." },
];

export const DOCS: readonly { label: string; path: string; what: string }[] = [
  { label: "UI Consistency", path: "docs/UI_CONSISTENCY.md", what: "The ten rules, the scales, and when a control is a toggle or a radio group" },
  { label: "UI Exceptions", path: "docs/UI_EXCEPTIONS.md", what: "Every place that breaks a rule on purpose, and why" },
  { label: "UI Inventory", path: "docs/UI_INVENTORY.md", what: "What the UI is actually built from, counted" },
  { label: "UI overview", path: "docs/UI.md", what: "Where to start, and the UI work that shipped" },
  { label: "Editor stylesheet", path: "app/src/styles.css", what: "The tokens: colors, fonts, radii, elevation, motion" },
  { label: "Shared class strings", path: "app/src/lib/styles.ts", what: "Tile states, the hover ring, confirm buttons" },
];

/** Every repo path this page links to, for the existence check. */
export const LINKED_PATHS: readonly string[] = [
  ...COMPONENTS.map((c) => c.source),
  ...DOCS.map((d) => d.path),
];
