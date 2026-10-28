# ADR-097: Saved export recipes live in Preferences, and the prefs sync document moves to format 2
Date: 2026-10-28   Status: draft (`feat/bulk-night`, night 10-28)   Relates to: ADR-061

## Context

Download All (the ZIP) wrote every photo at one format and quality. Bulk
night adds **export recipes**: a name, a size (exact W×H with a centered
cover crop, long edge, width, or keep), a format, a quality, and a file-name
pattern (`{name}` `{n}` `{w}` `{h}`). Three ship built in. The open question
was where a person's own saved recipes live, and how they reach a second
device without an older build on that device erasing them.

## Decision

1. **Recipes are preferences.** `Preferences.exportRecipes`
   (`app/src/lib/preferences.ts`) holds the saved ones, appended **last** in
   `serializePreferences`, because field order is the canonical serialization.
   The three built-ins live in `app/src/lib/exportRecipes.ts` (ids start with
   `builtin:`) and are never stored. `normalizeRecipes` drops an invalid entry
   instead of clamping it, refuses `builtin:` ids and duplicate ids, and stops
   at **20**.
2. **`PREFS_FORMAT` 1 → 2** (`app/src/lib/sync/docs.ts`). A format-1 build
   parses a format-2 blob without the recipes, and a push from it would write
   that back over them. `reconcile.ts` turns a push into **hold** when the
   remote format is newer, so the bump is what keeps an old build on a second
   device from erasing saved recipes. No Convex schema or function change:
   `users.settings` and `sync_docs.value` carry an opaque string.
3. **The chosen recipe is session state.** `useZipRecipeStore` (zustand, not
   persisted) holds the recipe for the *next* Download All, and
   `useZipExport.ts` reads it when the ZIP runs. That avoids a new prop wire
   through AppShell.
4. A recipe applies to the ZIP only. It works on a copy of the pixels and
   never changes a gallery photo.

## Consequences

+ Saved recipes sync across devices through the existing prefs document, with
  no new table, sync path or IndexedDB change. Signed out, they stay local.
+ Built-ins can be retuned in code and every device picks up the new values.
- A device still on a format-1 build now holds **every** prefs change it
  makes (theme, units, anything), not only recipe edits, until it updates.
  The change stays pending, but it doesn't sync.
- The prefs blob grows by up to 20 recipes, and every later prefs field has
  to be appended after `exportRecipes`, with its own format bump if an older
  build could erase it.
- The recipe choice resets on reload; nothing remembers the last one used.

## Alternatives rejected

- **A new Dexie table:** an IndexedDB schema change needs the
  `dexie-migration` procedure, and recipes are preferences, not documents.
- **A new Convex table, like `useUserColors`:** a third bespoke sync path,
  the thing ADR-061 consolidated.
- **Storing the built-ins too:** every device would freeze the values it
  first saw.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: recipes
grew into something closer to documents (per-recipe watermark, metadata
rules, a shared team set), and the 20-cap blob that rides with every theme
toggle became the wrong container. Each new recipe field then needed another
prefs format bump, and each bump paused prefs sync on any device left behind.
Early warning sign to watch for: a second `PREFS_FORMAT` bump driven by a
recipe field, or a report that settings stopped syncing on one device (a held
push on an old build).
