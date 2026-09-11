//! `photo_bounds` — the PHOTO's size, not the document's (#81).
//!
//! A default import is an artboard: a Canvas fill with the photo centred on
//! it, so the document is `photo + 2 * canvasPadding`. Reporting the document
//! told the user a number 20px larger than the file they opened, and the
//! resize panel then sized its aspect lock from it — type 400 and get a height
//! derived from 820:620 instead of 800:600.
//!
//! ⚠️ THE RULE IS STRUCTURAL, AND THESE TESTS EXIST TO PIN THAT. The obvious
//! implementation — "measure the non-transparent box" — passes every test here
//! EXCEPT `a_flattened_transparent_artboard_reports_the_whole_document`,
//! because `canvasBgColor` defaults to transparent: flattening onto a
//! transparent canvas leaves a layer whose non-transparent box is still just
//! the photo. Chris's rule is that a flattened image IS the image, canvas
//! included, so presence of a Canvas layer is the test, not pixels.
use stamp_tool::ImageHorseTool;

const PW: u32 = 800;
const PH: u32 = 600;
const PAD: u32 = 10;

fn photo(w: u32, h: u32) -> Vec<u8> {
    let mut px = vec![0u8; (w * h * 4) as usize];
    for (i, b) in px.iter_mut().enumerate() {
        *b = if i % 4 == 3 { 255 } else { 120 };
    }
    px
}

/// The default import path: photo centred on a TRANSPARENT canvas.
fn artboard() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(PW + 2 * PAD, PH + 2 * PAD);
    t.load_image_artboard(&photo(PW, PH), PW, PH, PAD, 0, 0, 0, 0);
    t
}

#[test]
fn an_artboard_reports_the_photo_not_the_document() {
    let t = artboard();
    assert_eq!(
        (t.width(), t.height()),
        (820, 620),
        "sanity: the DOCUMENT really is photo + 2*pad"
    );
    assert_eq!(
        t.photo_bounds(),
        vec![PAD, PAD, PW, PH],
        "the photo is 800x600 at (10,10) — the document's 820x620 is not the answer"
    );
}

/// The aspect-ratio bug in #81, stated as a number. Locking to the DOCUMENT
/// gives 400 -> 302; locking to the PHOTO gives the 400 -> 300 the user asked
/// for. This is the arithmetic the resize panel now does.
#[test]
fn the_photos_ratio_is_what_an_exact_width_should_use() {
    let t = artboard();
    let b = t.photo_bounds();
    let (pw, ph) = (b[2] as f64, b[3] as f64);
    let doc = (t.width() as f64, t.height() as f64);

    let from_photo = (400.0 / pw * ph).round() as u32;
    let from_doc = (400.0 / doc.0 * doc.1).round() as u32;
    assert_eq!(from_photo, 300, "400 wide at 4:3 is 300 tall");
    assert_eq!(
        from_doc, 302,
        "and locking to the document is where 302 came from"
    );
}

/// THE CASE A PIXEL-BASED RULE GETS WRONG. Flatten a photo onto a TRANSPARENT
/// canvas: the flattened layer's non-transparent box is still exactly the
/// photo, so a bbox-only rule would keep reporting 800x600. The structural
/// rule sees no Canvas layer and reports the document, which is what a
/// flattened image is.
#[test]
fn a_flattened_transparent_artboard_reports_the_whole_document() {
    let mut t = artboard();
    assert_eq!(t.photo_bounds(), vec![PAD, PAD, PW, PH]);

    t.flatten_all();
    assert_eq!(
        t.photo_bounds(),
        vec![0, 0, 820, 620],
        "flattened: the canvas IS part of the image now, so the document is the answer"
    );
}

/// A plain (non-artboard) load has no Canvas at all, so the document has
/// always been the picture.
#[test]
fn a_plain_load_has_no_canvas_and_reports_the_document() {
    let mut t = ImageHorseTool::new(PW, PH);
    t.load_image(&photo(PW, PH));
    assert_eq!(t.photo_bounds(), vec![0, 0, PW, PH]);
}

/// Removing the Canvas is the other way to reach "no mount", and it must land
/// on the same answer flattening does.
#[test]
fn removing_the_canvas_falls_back_to_the_document() {
    let mut t = artboard();
    assert_eq!(t.layer_count(), 2, "artboard = Canvas + Photo");

    // The Canvas is the bottom layer of an artboard document; `get_layers`
    // reports each layer's kind, so pick it by kind rather than by position.
    let json = t.get_layers();
    let canvas_id = first_id_with_kind(&json, "canvas").expect("artboard has a Canvas");
    assert!(t.remove_layer(canvas_id), "Canvas removed");

    // 800x600, NOT 820x620: `remove_layer` calls `shrink_to_content()` when the
    // layer it removed was the backing Canvas, so the document collapses onto
    // the photo. Both no-Canvas routes agree that the document IS the picture;
    // they just disagree on how big the document then is, and that is right —
    // flattening keeps the mount's pixels, removing the Canvas throws them away.
    assert_eq!(
        (t.width(), t.height()),
        (800, 600),
        "removing the Canvas shrinks the document to the photo"
    );
    assert_eq!(
        t.photo_bounds(),
        vec![0, 0, 800, 600],
        "no Canvas left, so the document is the picture"
    );
}

/// Minimal scan of `get_layers()`'s JSON for the first layer of a given kind.
/// Hand-rolled rather than pulling serde into the test profile, same as the
/// other engine tests here.
fn first_id_with_kind(json: &str, kind: &str) -> Option<u32> {
    for obj in json.trim_matches(['[', ']']).split("},{") {
        if obj.contains(&format!("\"kind\":\"{kind}\"")) {
            let after = obj.split("\"id\":").nth(1)?;
            let digits: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
            return digits.parse().ok();
        }
    }
    None
}

/// A photo that does not fill its own layer still measures its content, not
/// the buffer — the buffer is always document-sized.
#[test]
fn the_bbox_is_the_content_not_the_buffer() {
    let mut t = ImageHorseTool::new(400, 400);
    // Small photo on a big padded canvas: pad 100 => doc 400x400, photo 200.
    t.load_image_artboard(&photo(200, 200), 200, 200, 100, 0, 0, 0, 0);
    assert_eq!(t.photo_bounds(), vec![100, 100, 200, 200]);
}

/// RE-DERIVING THE NUMBER FROM THE CRASHED SESSION. It reported "resize to 400
/// exports 396x298" and that was never reproduced. This measures what actually
/// happens today, so the fix is aimed at a real number rather than a
/// remembered one.
#[test]
fn what_an_exact_width_of_400_actually_produces_today() {
    let mut t = artboard();
    // What the panel does today: fields hold the DOCUMENT (820x620), the lock
    // derives 302 from the document's ratio, and Apply resizes the DOCUMENT.
    let (doc_w, doc_h) = (t.width(), t.height());
    assert_eq!((doc_w, doc_h), (820, 620));
    let locked_h = (400.0 / doc_w as f64 * doc_h as f64).round() as u32;
    assert_eq!(locked_h, 302, "the document ratio is where 302 comes from");

    t.resize_with_filter(400, locked_h, 1);
    assert_eq!(
        (t.width(), t.height()),
        (400, 302),
        "the DOCUMENT is now 400x302"
    );

    // And the photo inside it — what actually exports when "Include canvas" is
    // off — is the bbox, scaled with everything else.
    let b = t.photo_bounds();
    println!(
        "MEASURED photo after resize-to-400: {}x{} at ({},{})",
        b[2], b[3], b[0], b[1]
    );
    assert!(
        b[2] < 400,
        "the photo is necessarily NARROWER than the width the user typed, \
         because the typed number sized the document and the mount ate the rest"
    );
}
