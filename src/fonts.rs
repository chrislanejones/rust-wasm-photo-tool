//! The font registry: which typeface `text.rs` rasterises with.
//!
//! Before this module there was exactly one answer — Liberation Sans, compiled
//! into the binary with `include_bytes!` — and `render_text` took no font
//! parameter at all. ADR-051 found the consequence: the Text tool's twelve-entry
//! font dropdown changed the textarea preview and nothing else, so text snapped
//! back to Liberation Sans the moment it was committed. The dropdown was cut to
//! one entry in #113 because a control that changes the preview and not the
//! result is worse than one that does nothing.
//!
//! ## Why the bytes arrive at runtime
//!
//! The deploy sentinel holds the wasm in an 800,000–840,000 B band (ADR-037,
//! ADR-045) — the only real detector of a featureless build. One more embedded
//! Liberation face is ~62,000 B against ~17,000 B of headroom: it misses by
//! more than 3×, and every future face would ask again. So faces are fetched as
//! static assets and handed here as bytes. **Nothing in this module grows the
//! wasm by the size of a font.**
//!
//! This is also exactly the entry point ADR-051's decided design needs — a Pro
//! user picking a `.ttf` off their own disk lands in the same `register` call.
//! The faces the app ships are simply the first caller.
//!
//! ## Why the registry stores BYTES, not parsed faces
//!
//! `ab_glyph` has two font types: `FontRef<'a>` borrows a slice, `FontVec` owns
//! one. Storing `FontVec` would give every consumer two types to handle and
//! force `text.rs`'s helpers to go generic. Storing the bytes and re-deriving a
//! `FontRef` per call means [`with_face`] hands out ONE type down every path,
//! embedded and registered alike, so `text.rs` needed no signature churn beyond
//! the new `font_id`.
//!
//! The cost is a `FontRef::try_from_slice` per `render_text` / `measure` /
//! `wrap`. That parse reads the table directory — a few dozen offsets — not the
//! outlines, and these run once per annotation tile rebuild, not per glyph.
//!
//! ## ⚠️ REGISTRATION IS MONOTONE, AND THAT IS LOAD-BEARING
//!
//! A registered id is never replaced and never removed. `app/src/lib/engine/
//! textMetricsCache.ts` caches `measure`/`text_ink_offset` answers keyed on
//! their arguments, and its whole safety argument is that those functions are
//! pure — "same arguments, same answer, for the life of the binary", so there
//! is nothing to invalidate. Adding a font id to the key keeps that true ONLY
//! while a given id always means the same outlines. If `register` ever starts
//! overwriting, every cached metric for that id silently goes stale and text
//! lands off its own preview.
//!
//! The matching hazard on the JS side is measuring a face BEFORE it is
//! registered: the fallback below would answer in Liberation Sans, and that
//! wrong answer would be cached against the real id forever. `ensureEngineFonts`
//! is awaited before any face can be selected for exactly that reason.

use crate::ImageHorseTool;
use ab_glyph::FontRef;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;

/// The face compiled into the binary, and what an empty `font_id` means.
/// Every document written before fonts existed means this.
pub const DEFAULT_FONT_ID: &str = "liberation-sans";

// Embedded fallback — the ONLY font bytes in the wasm, and the reason a
// document whose face is unavailable still renders instead of failing.
static EMBEDDED_REGULAR: &[u8] = include_bytes!("fonts/LiberationSans-Regular.ttf");
static EMBEDDED_BOLD: &[u8] = include_bytes!("fonts/LiberationSans-Bold.ttf");

thread_local! {
    /// `(family id, bold, raw TTF/OTF bytes)`. Empty at boot; filled by
    /// [`register`]. Thread-local rather than a field on `ImageHorseTool`
    /// because a face is a property of the BINARY, not of a document — the
    /// batch path's throwaway engine renders the same glyphs as the live one.
    ///
    /// ⚠️ A `Vec`, not a `HashMap`, and the reason is the size band. A
    /// `HashMap` pulls in `RandomState`, SipHash and the whole `RawTable`
    /// machinery, and none of it was reachable from this crate before; the
    /// wasm grew **5,181 B** for a lookup table that holds six entries (846,213
    /// -> 841,032, the HashMap swapped for this Vec and nothing else). A
    /// linear scan over six `&str` comparisons is not the slow part of
    /// rasterising a glyph, and it also lets the lookup take a `(&str, bool)`
    /// pair directly instead of allocating a formatted key on every call.
    static REGISTRY: RefCell<Vec<(String, bool, Vec<u8>)>> = const { RefCell::new(Vec::new()) };
}

/// Index of `(font_id, bold)` in the registry, if present.
fn find(reg: &[(String, bool, Vec<u8>)], font_id: &str, bold: bool) -> Option<usize> {
    reg.iter()
        .position(|(id, b, _)| *b == bold && id == font_id)
}

/// True when `font_id` is the embedded face (or unset). These never need
/// registering and can never fail.
pub fn is_default(font_id: &str) -> bool {
    font_id.is_empty() || font_id == DEFAULT_FONT_ID
}

/// Parse-check `bytes` and store them under `font_id` at the given weight.
///
/// Returns `Err` with a human-readable reason on anything `ab_glyph` cannot
/// read — a truncated download, a WOFF2 file (Brotli-compressed; `ab_glyph`
/// needs the raw TTF/OTF), or a hostile file. **It must never panic**: this is
/// the one place in the engine that takes bytes chosen outside it, and a panic
/// across the wasm boundary takes the whole app with it.
///
/// Re-registering an id that is already present is a no-op that reports
/// success — see the monotonicity note in the module doc. It is not an error
/// because two callers racing to register the same shipped face is normal.
pub fn register(font_id: &str, bold: bool, bytes: &[u8]) -> Result<(), String> {
    if font_id.is_empty() {
        return Err("font id is empty".into());
    }
    if is_default(font_id) {
        // Accepting this would let a caller shadow the fallback, which is the
        // one face that must always be readable.
        //
        // A literal, not `format!` — every `format!` reachable from the wasm
        // build is fmt machinery in the binary, and the band has four figures
        // of headroom, not five.
        return Err("'liberation-sans' is the embedded face and cannot be replaced".into());
    }
    if REGISTRY.with(|r| find(&r.borrow(), font_id, bold).is_some()) {
        return Ok(());
    }
    // The `ab_glyph` error is discarded rather than formatted in: its Display
    // impl is the only thing that would pull `core::fmt` into this path, and
    // its text ("InvalidFont") tells the user nothing the sentence below does
    // not. The distinctions that matter — which file, which face — are things
    // only the CALLER knows, and `engineFonts.ts` puts them in the message.
    if FontRef::try_from_slice(bytes).is_err() {
        return Err("not a readable TTF or OTF file".into());
    }
    REGISTRY.with(|r| {
        r.borrow_mut()
            .push((font_id.to_string(), bold, bytes.to_vec()))
    });
    Ok(())
}

/// Whether `font_id` can be rendered at `bold` right now — i.e. whether
/// [`with_face`] will use it rather than silently falling back.
///
/// The UI needs this to avoid the stale-metric hazard in the module doc: a
/// measurement taken while this is false answers in the WRONG face.
pub fn is_registered(font_id: &str, bold: bool) -> bool {
    if is_default(font_id) {
        return true;
    }
    REGISTRY.with(|r| find(&r.borrow(), font_id, bold).is_some())
}

/// The embedded Bold face, directly.
///
/// The red-stamp presets (`render_stamp_label`) use it unconditionally and
/// deliberately: a stamp is a fixed graphic asset with baked-in proportions,
/// not user-authored type, so it does not take a `font_id` and does not follow
/// the text tool's font. Exposed here so `text.rs` no longer owns the
/// `include_bytes!` and there is one place that knows where the face lives.
pub fn embedded_bold() -> FontRef<'static> {
    FontRef::try_from_slice(EMBEDDED_BOLD).expect("embedded font is valid")
}

/// The embedded Regular face, directly. Used by `text.rs`'s wrap tests, which
/// measure against the fallback deliberately.
#[cfg(test)]
pub fn embedded_regular() -> FontRef<'static> {
    FontRef::try_from_slice(EMBEDDED_REGULAR).expect("embedded font is valid")
}

/// Run `body` against the face `font_id` names, falling back to the embedded
/// Liberation Sans when it is unknown, unregistered, or unreadable.
///
/// **Fallback, never failure.** A document that names a face this binary does
/// not have still renders — in the wrong typeface, which is visible and
/// recoverable, rather than not at all. `is_registered` is how a caller finds
/// out before it matters; this function's job is that text always comes out.
///
/// A family registered Regular-only renders bold text in its Regular weight
/// rather than dropping to Liberation Sans, because keeping the typeface is a
/// closer answer than keeping the weight.
pub fn with_face<R>(font_id: &str, bold: bool, body: impl FnOnce(&FontRef<'_>) -> R) -> R {
    let embedded = if bold {
        EMBEDDED_BOLD
    } else {
        EMBEDDED_REGULAR
    };
    // `expect` on a byte slice fixed at compile time: if this ever fires the
    // build is corrupt, and there is no fallback left to offer.
    let fallback = || FontRef::try_from_slice(embedded).expect("embedded font is valid");

    if is_default(font_id) {
        return body(&fallback());
    }
    REGISTRY.with(|r| {
        let reg = r.borrow();
        let bytes = find(&reg, font_id, bold)
            .or_else(|| find(&reg, font_id, false))
            .map(|i| reg[i].2.as_slice());
        match bytes.map(FontRef::try_from_slice) {
            Some(Ok(f)) => body(&f),
            _ => body(&fallback()),
        }
    })
}

/// The wasm-bindgen surface for the registry.
///
/// A second `#[wasm_bindgen] impl` block on `ImageHorseTool`, the same shape
/// `annotations.rs` and `history.rs` already use — the bindings live beside the
/// code they expose, and `src/lib.rs` (a 4,900-line ratchet, `librs-lines` in
/// guardrails.sh) does not grow to hold them.
#[wasm_bindgen]
impl ImageHorseTool {
    /// Hand the engine a TTF/OTF face to rasterise with, under `font_id`.
    ///
    /// This is the whole runtime-font mechanism, and the reason it exists is
    /// arithmetic: the deploy sentinel holds the wasm in an 800,000–840,000 B
    /// band, one more embedded Liberation face is ~62,000 B, and the headroom
    /// is ~17,000. Fonts cannot be compiled in. They arrive here instead —
    /// today from `app/public/fonts` via `ensureEngineFonts`, and on ADR-051's
    /// roadmap from a file the user picks off their own disk. Same call.
    ///
    /// Returns an error string rather than panicking on anything unreadable —
    /// a truncated download, a WOFF2 file (`ab_glyph` needs the RAW outlines;
    /// WOFF2 is Brotli-compressed), a hostile file. This is the one engine
    /// entry point fed bytes chosen outside it, and a panic here takes the
    /// whole app down.
    ///
    /// Idempotent: re-registering an id already present succeeds and changes
    /// nothing. ⚠️ That is not politeness, it is what keeps the JS-side text
    /// metrics cache sound — read the monotonicity note in `crate::fonts`.
    ///
    /// The error type is `String`, NOT `JsValue`, and that is not a style
    /// choice. `JsValue` is unusable off wasm32 — the first native test of a
    /// REJECTED font file aborted the whole test process with "function not
    /// implemented on non-wasm32 targets / panic in a function that cannot
    /// unwind", because dropping the JsValue calls a wasm intrinsic. The
    /// rejection path is the entire point of this function, so it has to be
    /// the part `cargo test` can reach. `String: Into<JsValue>`, so JS is
    /// thrown the same message either way.
    pub fn register_font(&self, font_id: &str, bold: bool, bytes: &[u8]) -> Result<(), String> {
        crate::fonts::register(font_id, bold, bytes)
    }

    /// Whether `font_id` at `bold` will actually be used, rather than silently
    /// falling back to the embedded Liberation Sans.
    ///
    /// The UI must check this before it lets a face be selected. Measuring an
    /// unregistered face answers in the WRONG one, and `textMetricsCache`
    /// would then hold that wrong answer against the real id for the life of
    /// the page.
    pub fn has_font(&self, font_id: &str, bold: bool) -> bool {
        crate::fonts::is_registered(font_id, bold)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The bytes the app actually ships for its serif face, read from the
    /// static assets so a test cannot pass against a font the app does not
    /// serve. Skips (rather than fails) if the asset is absent, so a checkout
    /// without `app/public` still builds green.
    fn serif_bytes() -> Option<Vec<u8>> {
        std::fs::read("app/public/fonts/LiberationSerif-Regular.ttf").ok()
    }

    #[test]
    fn default_id_and_empty_both_mean_the_embedded_face() {
        assert!(is_default(""));
        assert!(is_default(DEFAULT_FONT_ID));
        assert!(!is_default("liberation-serif"));
        // …and the embedded face is always usable, with nothing registered.
        assert!(is_registered("", true));
        assert!(is_registered(DEFAULT_FONT_ID, false));
    }

    #[test]
    fn garbage_bytes_are_rejected_without_panicking() {
        let err = register("junk-face", false, &[0u8; 64]).unwrap_err();
        assert!(err.contains("not a readable"), "got: {err}");
        assert!(!is_registered("junk-face", false));
    }

    #[test]
    fn an_empty_id_and_the_embedded_id_are_both_refused() {
        assert!(register("", false, &[0u8; 4]).is_err());
        let err = register(DEFAULT_FONT_ID, false, EMBEDDED_REGULAR).unwrap_err();
        assert!(err.contains("cannot be replaced"), "got: {err}");
    }

    #[test]
    fn an_unregistered_face_falls_back_rather_than_failing() {
        // The whole point: a document naming a face this binary does not have
        // still renders. Same glyph id, same advance, as the embedded face.
        let a = with_face("nobody-has-this", false, |f| {
            use ab_glyph::Font;
            f.glyph_id('W')
        });
        let b = with_face(DEFAULT_FONT_ID, false, |f| {
            use ab_glyph::Font;
            f.glyph_id('W')
        });
        assert_eq!(a, b);
    }

    #[test]
    fn a_registered_face_is_actually_used() {
        // ⚠️ ADR-051: "Any test must assert the rendered text changed — a
        // composite hash or ink extents — not that an option appeared in a
        // dropdown." So this compares ADVANCE WIDTHS, which are a property of
        // the outlines. Liberation Serif is NOT metric-compatible with
        // Liberation Sans (Times vs Arial metrics), so a real swap moves them.
        let Some(bytes) = serif_bytes() else {
            eprintln!("skip: app/public/fonts/LiberationSerif-Regular.ttf absent");
            return;
        };
        register("test-serif", false, &bytes).expect("serif asset is readable"); // allow: rust-panic
        assert!(is_registered("test-serif", false));

        let width = |id: &str| {
            with_face(id, false, |f| {
                use ab_glyph::{Font, PxScale, ScaleFont};
                let sf = f.as_scaled(PxScale::from(32.0));
                "The quick brown fox"
                    .chars()
                    .map(|c| sf.h_advance(sf.glyph_id(c)))
                    .sum::<f32>()
            })
        };
        let sans = width(DEFAULT_FONT_ID);
        let serif = width("test-serif");
        assert!(
            (sans - serif).abs() > 1.0,
            "registered face rendered at the SAME advance as the fallback \
             ({sans} vs {serif}) — the registry is not being consulted"
        );
    }

    #[test]
    fn bold_falls_back_to_the_family_regular_before_the_embedded_face() {
        let Some(bytes) = serif_bytes() else { return };
        register("test-serif-regular-only", false, &bytes).expect("readable"); // allow: rust-panic
                                                                               // Nothing registered at bold, but the family's own Regular is closer
                                                                               // than Liberation Sans Bold, so the advance must match the Regular.
        let w = |id: &str, bold: bool| {
            with_face(id, bold, |f| {
                use ab_glyph::{Font, PxScale, ScaleFont};
                let sf = f.as_scaled(PxScale::from(32.0));
                "Hamburgefonstiv"
                    .chars()
                    .map(|c| sf.h_advance(sf.glyph_id(c)))
                    .sum::<f32>()
            })
        };
        assert_eq!(
            w("test-serif-regular-only", true),
            w("test-serif-regular-only", false),
            "bold on a Regular-only family should keep the TYPEFACE"
        );
    }
}
