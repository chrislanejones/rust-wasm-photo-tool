# Image Horse product context

## Register

product

## Users

People editing and annotating photos in a browser, including logged-out users and people working with a gallery of images. The supported phone surface focuses on browsing; the desktop editor provides tools and document controls.

## Product Purpose

Image Horse edits pixels locally through Rust/WASM and keeps originals and edits in IndexedDB. Optional cloud persistence and AI enhance the local workflow. Sources: README.md and CLAUDE.md.

## Brand Personality

Direct, practical, and trustworthy. Controls should explain the state of the current document and preserve the established warm paper and earth-tone visual identity. Sources: docs/UI_CONSISTENCY.md and app/src/styles.css.

## Anti-references

Avoid duplicate primitives, arbitrary spacing and colors, decorative motion, stale document readouts, and misleading progress. The existing editor is the reference; this work is a correctness pass.

## Design Principles

- The engine owns the document and pixels.
- The selected photo and the committed engine document must not be confused.
- Reuse the measured design vocabulary and shared primitives.
- Keep global preferences separate from document and preview state.
- Explain failure and preserve a recoverable workflow.

## Accessibility & Inclusion

WCAG 2.1 AA, keyboard reach, visible focus, named controls, reduced-motion support, and the established desktop, dock/tablet, and phone behavior. Sources: CLAUDE.md and docs/UI_CONSISTENCY.md.
