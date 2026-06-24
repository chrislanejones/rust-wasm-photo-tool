# Future: Settings → General tab

Parking lot for what to put in the **General** tab of the Settings modal
(`SubscriptionButton.tsx` → GNOME-style rail; currently renders "Nothing here
yet."). Come back and pick from this.

## Current state (what we have to work with)

- **No theme system** — app is dark-only, no `data-theme` / light mode.
- **No reduced-motion handling** — framer-motion spring animations always on
  (`lib/animations.ts` `panelSpacingTransition`, modal scale, zoom).
- **No persisted preferences** — `lib/defaultToolSettings.ts` is a static const;
  tool settings reset every session (held in `AppShell` state, line ~153).
- **localStorage already used** (pattern to copy) for:
  - custom colors — `hooks/useUserColors.ts` (`image-horse-user-colors`, uses
    `useSyncExternalStore` + cross-tab `storage` event)
  - recent texts — `hooks/useRecentTexts.ts` (`image-horse-recent-texts`)
- **IndexedDB** caches: originals (`image-horse-originals`,
  `lib/originalsStore.ts`) and edits (`image-horse-edits`,
  `lib/editPersistence.ts`).

> Suggested foundation: a small `usePreferences` hook (mirror `useUserColors`'s
> `useSyncExternalStore` + localStorage pattern, key `image-horse-prefs`) holding
> a single JSON prefs object. Everything below reads/writes through it.

---

## Proposed settings (grouped GNOME-style)

### Export defaults  ⭐ top pick (Image Horse is a compression tool first)
Persist so every new image starts how you like, instead of resetting to the const.
- Default **format** — JPEG / PNG / WebP
- Default **quality** — slider
- **EXIF on export** — Keep / Strip (the padlock default)
- **Wiring:** seed `defaultToolSettings.format` / `.quality` and the EXIF policy
  from prefs on load; the Compress panel already owns these controls.
- **Effort:** low–medium (needs the prefs store).

### Appearance
- **Accent color** — the warm `#fcdfc2` tone (`--theme-primary` / `--accent` /
  `--ring` in `styles.css`). Reuse `ColorSwatchGrid` + `useUserColors`.
  - Wiring: set the CSS var on `:root` from a saved value. Effort: medium
    (no theme infra yet — this introduces the first themed var).
- **Reduce motion** — toggle to tone down panel/zoom spring animations; also
  respect OS `prefers-reduced-motion`.
  - Wiring: a flag that swaps `panelSpacingTransition` (and modal/zoom springs)
    for `{ duration: 0 }`; combine with a `matchMedia` check. Effort: medium
    (thread the flag through `lib/animations.ts` consumers).
  - Genuine a11y + slow-machine win; nothing handles it today.

### Behavior
- **Confirm before "Delete All images"** — toggle (Delete-All dialog already
  exists; this gates whether it shows).
- **Restore last session on launch** — auto-reopen the last edits (we already
  persist to `image-horse-edits`). Note: today a reload drops back to the upload
  dialog for logged-out users.
- **Effort:** low (confirm toggle) / medium (restore).

### Data & privacy  (GNOME puts this at the bottom)
- **Clear local data** — one button wiping saved colors
  (`image-horse-user-colors`), recent texts (`image-horse-recent-texts`), and the
  IndexedDB caches (`image-horse-originals`, `image-horse-edits`).
  - Wiring: clear the LS keys + `indexedDB.deleteDatabase(...)`. Effort: low.
  - Style as a danger-zone button (the destructive `LargeButton` variant).

---

## Other tab ideas (not General)
- **Super User** — done (admin-gated tier override).
- **Plan & Billing** — done (Stripe).
- Maybe later: **Shortcuts** tab (the keyboard-shortcuts list lives in
  `ShortcutModal`; could move/duplicate here), **Account/Profile**.

## Notes
- All of the above are client-side prefs; nothing here is a security boundary.
- Keep the pane visual language consistent with `SuperUserPane` (section
  heading + `space-y-4`, `ToggleButtonGroup` for choices, `LargeButton` actions).
